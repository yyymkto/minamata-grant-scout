/**
 * Ingest オーケストレータ — cron/手動トリガーから呼ばれる
 *
 * 1. jGrants APIから一覧取得 → D1に新規保存
 * 2. 新規分をQueue投入（詳細取得→AI解析）
 */
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { grants, grantAiAnalyses } from "../../db/schema";
import { fetchGrantList, enrichGrantDetail, type RawGrant } from "./jgrants-source";
import { analyzeGrant, type AnalysisResult } from "./analyzer";
import { logEvent } from "../../lib/logging";
import type { Env } from "../../types";

/** cron/手動で呼ばれる: 一覧取得→D1保存→Queue投入 */
export async function ingestGrantList(env: Env): Promise<{
  total: number;
  newCount: number;
  skipped: number;
  queued: number;
}> {
  const db = drizzle(env.DB);
  const rawGrants = await fetchGrantList();

  let newCount = 0;
  let skipped = 0;
  let queued = 0;

  for (const g of rawGrants) {
    // 重複チェック
    const [existing] = await db
      .select({ id: grants.id })
      .from(grants)
      .where(eq(grants.sourceUrl, g.source_url));

    if (existing) {
      skipped++;
      continue;
    }

    // D1に保存
    await db.insert(grants).values({
      title: g.title,
      sourceMinistry: g.source_ministry,
      sourceUrl: g.source_url,
      publishedAt: g.published_at,
      deadline: g.deadline,
      rawText: null, // 詳細取得後にQueue consumerが埋める
      categoryRaw: g.category_raw,
    });

    // 保存したIDを取得
    const [inserted] = await db
      .select({ id: grants.id })
      .from(grants)
      .where(eq(grants.sourceUrl, g.source_url));

    if (inserted) {
      // Queue投入: まず詳細取得
      await env.JOBS.send({
        type: "grant.fetch_detail",
        payload: { grantId: inserted.id, jgrantsId: g.jgrants_id },
      });
      queued++;
    }

    newCount++;
  }

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
  payload: { grantId: number; jgrantsId: string }
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

  // 詳細取得してraw_text・省庁名を埋める
  const rawGrant: RawGrant = {
    title: grant.title,
    source_ministry: grant.sourceMinistry,
    source_url: grant.sourceUrl,
    published_at: grant.publishedAt,
    deadline: grant.deadline,
    raw_text: grant.rawText,
    category_raw: grant.categoryRaw,
    jgrants_id: payload.jgrantsId,
  };

  await enrichGrantDetail(rawGrant);

  // D1を更新
  await db
    .update(grants)
    .set({
      rawText: rawGrant.raw_text,
      sourceMinistry: rawGrant.source_ministry,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(grants.id, payload.grantId));

  logEvent("info", "job.fetch_detail.done", {
    grantId: payload.grantId,
    ministry: rawGrant.source_ministry,
    hasText: !!rawGrant.raw_text,
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
    env.KIMI_API_KEY
  );

  if (!analysis) {
    logEvent("warn", "job.analyze.failed", { grantId: payload.grantId, title: grant.title });
    throw new Error(`AI analysis failed for grant ${payload.grantId}`); // retryさせる
  }

  const categories = Array.isArray(analysis.tara_categories)
    ? analysis.tara_categories.join(",")
    : analysis.tara_categories ?? null;

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
    taraFitRank: analysis.tara_fit_rank,
    taraFitScore: analysis.tara_fit_score,
    taraFitReason: analysis.tara_fit_reason,
    suggestedDepartment: analysis.suggested_department,
    suggestedDepartmentReason: analysis.suggested_department_reason,
    taraUseCase: analysis.tara_use_case,
    taraCategories: categories,
  });

  logEvent("info", "job.analyze.done", {
    grantId: payload.grantId,
    rank: analysis.tara_fit_rank,
    score: analysis.tara_fit_score,
  });
}
