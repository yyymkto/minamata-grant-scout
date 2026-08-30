/**
 * Ingest オーケストレータ — cron/手動トリガーから呼ばれる
 *
 * 1. jGrants API + 熊本県公式サイトRSSから一覧取得 → D1に新規保存（ON CONFLICT対応）
 * 2. 新規分をQueue投入（詳細取得→AI解析）
 */
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { eq, sql, isNull, inArray } from "drizzle-orm";
import { grants, grantAiAnalyses, systemMeta } from "../../db/schema";
import { fetchGrantList, enrichGrantDetail, type RawGrant } from "./jgrants-source";
import { fetchKumamotoPrefGrantList, fetchKumamotoPrefArticleBody } from "./kumamoto-pref-source";
import { analyzeGrant } from "./analyzer";
import { logEvent } from "../../lib/logging";
import type { Env } from "../../types";

type IngestSource = "jgrants" | "kumamoto_pref";

interface IngestableGrant {
  title: string;
  source_ministry: string;
  source_url: string;
  published_at: string | null;
  deadline: string | null;
  category_raw: string | null;
  source: IngestSource;
  jgrants_id?: string;
}

/** cron/手動で呼ばれる: 一覧取得→D1保存→Queue投入 */
export async function ingestGrantList(env: Env): Promise<{
  total: number;
  newCount: number;
  skipped: number;
  queued: number;
}> {
  const db = drizzle(env.DB);

  const [jgrantsRaw, kumamotoPrefRaw] = await Promise.all([
    fetchGrantList(),
    fetchKumamotoPrefGrantList(),
  ]);

  const rawGrants: IngestableGrant[] = [
    ...jgrantsRaw.map((g) => ({ ...g, source: "jgrants" as const })),
    ...kumamotoPrefRaw.map((g) => ({ ...g, source: "kumamoto_pref" as const })),
  ];

  if (rawGrants.length === 0) {
    logEvent("warn", "ingest.empty_result", {
      message: "jGrants API / 熊本県RSS returned 0 grants — possible upstream outage",
    });
    // Record that the cron ran, even with 0 results
    await upsertMeta(db, "last_cron_at", new Date().toISOString());
    await upsertMeta(db, "last_cron_new_count", "0");
    return { total: 0, newCount: 0, skipped: 0, queued: 0 };
  }

  let newCount = 0;
  let skipped = 0;
  let queued = 0;

  // Queue messages をバッチ送信用に収集
  const queueMessages: { type: string; payload: Record<string, unknown> }[] = [];

  for (const g of rawGrants) {
    // INSERT ... ON CONFLICT DO NOTHING でアトミックに重複チェック
    const result = await db.run(
      sql`INSERT INTO grants (title, source_ministry, source_url, published_at, deadline, raw_text, category_raw)
          VALUES (${g.title}, ${g.source_ministry}, ${g.source_url}, ${g.published_at}, ${g.deadline}, NULL, ${g.category_raw})
          ON CONFLICT (source_url) DO NOTHING`
    );

    if (!result.meta.changes || result.meta.changes === 0) {
      skipped++;
      continue;
    }

    // 挿入されたIDを取得
    const [inserted] = await db
      .select({ id: grants.id })
      .from(grants)
      .where(eq(grants.sourceUrl, g.source_url));

    if (inserted) {
      queueMessages.push({
        type: "grant.fetch_detail",
        payload: { grantId: inserted.id, source: g.source, jgrantsId: g.jgrants_id },
      });
      queued++;
    }

    newCount++;
  }

  // Queue バッチ送信
  if (queueMessages.length > 0) {
    const batches = [];
    for (let i = 0; i < queueMessages.length; i += 100) {
      batches.push(queueMessages.slice(i, i + 100));
    }
    for (const batch of batches) {
      await env.JOBS.sendBatch(
        batch.map((msg) => ({ body: msg }))
      );
    }
  }

  // Record cron run result
  const now = new Date().toISOString();
  await upsertMeta(db, "last_cron_at", now);
  await upsertMeta(db, "last_cron_new_count", String(newCount));

  logEvent("info", "ingest.complete", {
    total: rawGrants.length,
    new: newCount,
    skipped,
    queued,
  });

  return { total: rawGrants.length, newCount, skipped, queued };
}

/** Queue consumer: 詳細取得ジョブ */
export async function handleFetchDetail(
  env: Env,
  payload: { grantId: number; source?: IngestSource; jgrantsId?: string }
): Promise<void> {
  const db = drizzle(env.DB);
  const [grant] = await db
    .select()
    .from(grants)
    .where(eq(grants.id, payload.grantId));

  if (!grant) {
    logEvent("warn", "job.fetch_detail.not_found", { grantId: payload.grantId });
    return;
  }

  let rawText: string | null = null;
  let sourceMinistry = grant.sourceMinistry;

  if (payload.source === "kumamoto_pref") {
    // 熊本県公式サイトの記事本文を取得（省庁名は一覧取得時点で確定済みなので上書き不要）
    rawText = await fetchKumamotoPrefArticleBody(grant.sourceUrl);
  } else {
    // jGrants詳細取得してraw_text・省庁名を埋める
    const rawGrant: RawGrant = {
      title: grant.title,
      source_ministry: grant.sourceMinistry,
      source_url: grant.sourceUrl,
      published_at: grant.publishedAt,
      deadline: grant.deadline,
      raw_text: grant.rawText,
      category_raw: grant.categoryRaw,
      jgrants_id: payload.jgrantsId ?? "",
    };
    await enrichGrantDetail(rawGrant);
    rawText = rawGrant.raw_text;
    sourceMinistry = rawGrant.source_ministry;
  }

  // 詳細取得できなかった場合はthrowしてretryさせる
  if (!rawText && !grant.rawText) {
    logEvent("warn", "job.fetch_detail.no_text", { grantId: payload.grantId, source: payload.source });
    throw new Error(`Detail fetch failed for grant ${payload.grantId} — will retry`);
  }

  // D1を更新
  await db
    .update(grants)
    .set({
      rawText,
      sourceMinistry,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(grants.id, payload.grantId));

  logEvent("info", "job.fetch_detail.done", {
    grantId: payload.grantId,
    source: payload.source,
    ministry: sourceMinistry,
    hasText: !!rawText,
  });

  // 次のジョブ: AI解析をQueue投入
  await env.JOBS.send({
    type: "grant.analyze",
    payload: { grantId: payload.grantId },
  });
}

/** Queue consumer: AI解析ジョブ */
export async function handleAnalyze(
  env: Env,
  payload: { grantId: number }
): Promise<void> {
  const db = drizzle(env.DB);
  const [grant] = await db
    .select()
    .from(grants)
    .where(eq(grants.id, payload.grantId));

  if (!grant) {
    logEvent("warn", "job.analyze.not_found", { grantId: payload.grantId });
    return;
  }

  // 既に解析済みならスキップ
  const [existingAnalysis] = await db
    .select({ id: grantAiAnalyses.id })
    .from(grantAiAnalyses)
    .where(eq(grantAiAnalyses.grantId, payload.grantId));

  if (existingAnalysis) {
    logEvent("info", "job.analyze.already_done", { grantId: payload.grantId });
    return;
  }

  const analysis = await analyzeGrant(
    {
      title: grant.title,
      source_ministry: grant.sourceMinistry,
      source_url: grant.sourceUrl,
      deadline: grant.deadline,
      raw_text: grant.rawText,
    },
    env
  );

  if (!analysis) {
    logEvent("warn", "job.analyze.failed", { grantId: payload.grantId, title: grant.title });
    throw new Error(`AI analysis failed for grant ${payload.grantId}`); // retryさせる
  }

  const categories = Array.isArray(analysis.minamata_categories)
    ? analysis.minamata_categories.join(",")
    : analysis.minamata_categories ?? null;

  await db.insert(grantAiAnalyses).values({
    grantId: payload.grantId,
    summaryShort: analysis.summary_short,
    supportType: analysis.support_type,
    targetEntities: analysis.target_entities,
    maxAmount: analysis.max_amount,
    subsidyRate: analysis.subsidy_rate,
    eligibleThemes: analysis.eligible_themes,
    requiredDocuments: analysis.required_documents,
    notes: analysis.notes,
    aiConfidence: analysis.ai_confidence,
    minamataFitRank: analysis.minamata_fit_rank,
    minamataFitScore: analysis.minamata_fit_score,
    minamataFitReason: analysis.minamata_fit_reason,
    suggestedDepartment: analysis.suggested_department,
    suggestedDepartmentReason: analysis.suggested_department_reason,
    minamataUseCase: analysis.minamata_use_case,
    minamataCategories: categories,
  }).onConflictDoNothing();

  logEvent("info", "job.analyze.done", {
    grantId: payload.grantId,
    rank: analysis.minamata_fit_rank,
    score: analysis.minamata_fit_score,
  });
}

/**
 * 既存の解析結果を削除し、AI解析ジョブをQueueに再投入する
 * grantIds未指定なら全件、指定ありならその補助金のみ対象
 */
export async function reanalyzeGrants(
  env: Env,
  grantIds?: number[]
): Promise<{ requeued: number }> {
  const db = drizzle(env.DB);

  const targetIds =
    grantIds && grantIds.length > 0
      ? grantIds
      : (await db.select({ id: grants.id }).from(grants)).map((g) => g.id);

  if (targetIds.length === 0) {
    return { requeued: 0 };
  }

  // 既存の解析結果を削除（handleAnalyzeは既存解析があるとスキップするため）
  // D1のバインド変数上限に収まるよう分割実行
  const DELETE_CHUNK_SIZE = 50;
  for (let i = 0; i < targetIds.length; i += DELETE_CHUNK_SIZE) {
    const chunk = targetIds.slice(i, i + DELETE_CHUNK_SIZE);
    await db.delete(grantAiAnalyses).where(inArray(grantAiAnalyses.grantId, chunk));
  }

  const queueMessages = targetIds.map((id) => ({
    body: { type: "grant.analyze", payload: { grantId: id } },
  }));

  const batches = [];
  for (let i = 0; i < queueMessages.length; i += 100) {
    batches.push(queueMessages.slice(i, i + 100));
  }
  for (const batch of batches) {
    await env.JOBS.sendBatch(batch);
  }

  logEvent("info", "reanalyze.requeued", { count: targetIds.length });

  return { requeued: targetIds.length };
}

/** Upsert a system_meta key */
async function upsertMeta(db: DrizzleD1Database, key: string, value: string) {
  await db.insert(systemMeta).values({ key, value, updatedAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: systemMeta.key,
      set: { value, updatedAt: new Date().toISOString() },
    });
}
