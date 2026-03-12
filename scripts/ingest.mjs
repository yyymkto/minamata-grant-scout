#!/usr/bin/env node

/**
 * ingest.mjs — 補助金情報の取得→保存→AI解析→結果保存
 *
 * Usage:
 *   node scripts/ingest.mjs                        # 全ソースからローカルD1へ
 *   node scripts/ingest.mjs --source maff           # 農水省のみ
 *   node scripts/ingest.mjs --remote                # リモートD1
 *   node scripts/ingest.mjs --dry-run               # DB書き込みなし
 *   node scripts/ingest.mjs --skip-analysis          # AI解析スキップ
 *   node scripts/ingest.mjs --analyze-only           # 未解析レコードのみAI解析
 */

import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { getPrimaryD1DatabaseName, readWranglerConfig } from "./lib/wrangler-config.mjs";
import { analyzeGrant } from "./lib/analyzer.mjs";

// ── ソースプラグイン ──────────────────────────

const SOURCES = {};

// 動的にsources/ディレクトリからロード
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourcesDir = join(__dirname, "sources");

try {
  const files = readdirSync(sourcesDir).filter((f) => f.endsWith(".mjs"));
  for (const file of files) {
    const mod = await import(join(sourcesDir, file));
    const name = file.replace(".mjs", "");
    SOURCES[name] = mod;
  }
} catch {
  // sources/ が空でもOK
}

// ── CLI引数 ──────────────────────────────────

const { values } = parseArgs({
  options: {
    source: { type: "string" },
    limit: { type: "string" },
    remote: { type: "boolean" },
    "dry-run": { type: "boolean" },
    "skip-analysis": { type: "boolean" },
    "analyze-only": { type: "boolean" },
  },
});

const mode = values.remote ? "--remote" : "--local";
const dryRun = values["dry-run"] ?? false;
const skipAnalysis = values["skip-analysis"] ?? false;
const analyzeOnly = values["analyze-only"] ?? false;
const sourceFilter = values.source;
const limit = values.limit ? Number(values.limit) : Infinity;

// ── DB接続 ──────────────────────────────────

const { config } = await readWranglerConfig();
const dbName = getPrimaryD1DatabaseName(config);
if (!dbName) {
  console.error("d1_databases[0].database_name not found in wrangler.jsonc");
  process.exit(1);
}

function esc(v) {
  if (v === null || v === undefined) return "NULL";
  return `'${String(v).replaceAll("'", "''")}'`;
}

function execSql(sql) {
  const result = spawnSync("npx", ["wrangler", "d1", "execute", dbName, mode, "--command", sql], {
    stdio: "pipe",
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    console.error(`  [db-error] ${result.stderr || result.stdout}`);
    return false;
  }
  return true;
}

function execSqlJson(sql) {
  const result = spawnSync("npx", ["wrangler", "d1", "execute", dbName, mode, "--command", sql, "--json"], {
    stdio: "pipe",
    encoding: "utf-8",
  });
  if (result.status !== 0) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

// ── メイン処理 ────────────────────────────────

const sourceNames = sourceFilter
  ? [sourceFilter]
  : Object.keys(SOURCES);

if (sourceNames.length === 0) {
  console.log("ソースプラグインがありません。scripts/sources/ にプラグインを追加してください。");
  console.log("例: scripts/sources/maff.mjs");
  console.log("");
  console.log("プラグインの形式:");
  console.log("  export const label = '農林水産省';");
  console.log("  export async function fetchGrants() {");
  console.log("    return [{ title, source_ministry, source_url, deadline?, raw_text?, category_raw? }];");
  console.log("  }");
  process.exit(0);
}

let totalNew = 0;
let totalSkipped = 0;
let totalAnalyzed = 0;
let totalAnalysisFailed = 0;

// ── analyze-only モード ─────────────────────────
if (analyzeOnly) {
  console.log("\n── analyze-only モード: 未解析レコードをAI解析 ──");

  const limitClause = limit === Infinity ? "" : ` LIMIT ${limit}`;
  const rows = execSqlJson(
    `SELECT g.id, g.title, g.source_ministry, g.source_url, g.deadline, g.raw_text FROM grants g LEFT JOIN grant_ai_analyses a ON a.grant_id = g.id WHERE a.id IS NULL ORDER BY g.created_at DESC${limitClause}`
  );

  const grants = rows?.[0]?.results ?? [];
  console.log(`  未解析: ${grants.length}件\n`);

  for (const grant of grants) {
    console.log(`  → ${grant.title.substring(0, 60)}...`);
    console.log(`    AI解析中...`);

    try {
      const analysis = await analyzeGrant({
        title: grant.title,
        source_ministry: grant.source_ministry,
        source_url: grant.source_url,
        deadline: grant.deadline,
        raw_text: grant.raw_text,
      });

      if (analysis) {
        const analysisSql = `INSERT INTO grant_ai_analyses (grant_id, summary_short, support_type, target_entities, max_amount, subsidy_rate, eligible_themes, required_documents, notes, ai_confidence, tara_fit_rank, tara_fit_score, tara_fit_reason, suggested_department, suggested_department_reason, tara_use_case)
           VALUES (${grant.id}, ${esc(analysis.summary_short)}, ${esc(analysis.support_type)}, ${esc(analysis.target_entities)}, ${esc(analysis.max_amount)}, ${esc(analysis.subsidy_rate)}, ${esc(analysis.eligible_themes)}, ${esc(analysis.required_documents)}, ${esc(analysis.notes)}, ${analysis.ai_confidence ?? "NULL"}, ${esc(analysis.tara_fit_rank)}, ${analysis.tara_fit_score ?? "NULL"}, ${esc(analysis.tara_fit_reason)}, ${esc(analysis.suggested_department)}, ${esc(analysis.suggested_department_reason)}, ${esc(analysis.tara_use_case)})`;

        if (execSql(analysisSql)) {
          totalAnalyzed++;
          console.log(`    ✓ ランク${analysis.tara_fit_rank} (${analysis.tara_fit_score}点)`);
        }
      } else {
        totalAnalysisFailed++;
        console.log(`    ✗ AI解析失敗（結果なし）`);
      }
    } catch (err) {
      totalAnalysisFailed++;
      console.error(`    [error] AI解析エラー: ${err.message}`);
    }
  }

  console.log(`\n── 完了 ──`);
  console.log(`  AI解析完了: ${totalAnalyzed}件`);
  console.log(`  AI解析失敗: ${totalAnalysisFailed}件`);
  process.exit(0);
}

for (const name of sourceNames) {
  const src = SOURCES[name];
  if (!src) {
    console.error(`ソース "${name}" が見つかりません`);
    continue;
  }

  console.log(`\n── ${src.label || name} ──`);

  let items;
  try {
    items = await src.fetchGrants();
    console.log(`  ${items.length}件取得`);
  } catch (err) {
    console.error(`  [error] フェッチ失敗: ${err.message}`);
    continue;
  }

  for (const item of items) {
    // 重複チェック
    const existing = execSqlJson(
      `SELECT id FROM grants WHERE source_url = ${esc(item.source_url)}`
    );
    const alreadyExists = existing?.[0]?.results?.length > 0;

    if (alreadyExists) {
      totalSkipped++;
      continue;
    }

    console.log(`  + ${item.title.substring(0, 50)}...`);

    if (dryRun) {
      totalNew++;
      continue;
    }

    // grants テーブルに保存（raw_textはシェル引数上限を避けるため2000文字に制限）
    const rawText = item.raw_text ? item.raw_text.substring(0, 2000) : null;
    const insertSql = `INSERT INTO grants (title, source_ministry, source_url, published_at, deadline, raw_text, category_raw)
       VALUES (${esc(item.title)}, ${esc(item.source_ministry)}, ${esc(item.source_url)}, ${esc(item.published_at ?? null)}, ${esc(item.deadline ?? null)}, ${esc(rawText)}, ${esc(item.category_raw ?? null)})`;

    if (!execSql(insertSql)) {
      console.error(`    保存失敗: ${item.title}`);
      continue;
    }
    totalNew++;

    // AI解析
    if (!skipAnalysis) {
      console.log(`    → AI解析中...`);
      try {
        const analysis = await analyzeGrant({
          title: item.title,
          source_ministry: item.source_ministry,
          source_url: item.source_url,
          deadline: item.deadline,
          raw_text: item.raw_text,
        });

        if (analysis) {
          // grant_id を取得
          const grantRow = execSqlJson(
            `SELECT id FROM grants WHERE source_url = ${esc(item.source_url)}`
          );
          const grantId = grantRow?.[0]?.results?.[0]?.id;

          if (grantId) {
            const analysisSql = `INSERT INTO grant_ai_analyses (grant_id, summary_short, support_type, target_entities, max_amount, subsidy_rate, eligible_themes, required_documents, notes, ai_confidence, tara_fit_rank, tara_fit_score, tara_fit_reason, suggested_department, suggested_department_reason, tara_use_case)
               VALUES (${grantId}, ${esc(analysis.summary_short)}, ${esc(analysis.support_type)}, ${esc(analysis.target_entities)}, ${esc(analysis.max_amount)}, ${esc(analysis.subsidy_rate)}, ${esc(analysis.eligible_themes)}, ${esc(analysis.required_documents)}, ${esc(analysis.notes)}, ${analysis.ai_confidence ?? "NULL"}, ${esc(analysis.tara_fit_rank)}, ${analysis.tara_fit_score ?? "NULL"}, ${esc(analysis.tara_fit_reason)}, ${esc(analysis.suggested_department)}, ${esc(analysis.suggested_department_reason)}, ${esc(analysis.tara_use_case)})`;

            if (execSql(analysisSql)) {
              totalAnalyzed++;
              console.log(`    ✓ ランク${analysis.tara_fit_rank} (${analysis.tara_fit_score}点)`);
            }
          }
        } else {
          console.log(`    ✗ AI解析失敗（結果なし）`);
        }
      } catch (err) {
        console.error(`    [error] AI解析エラー: ${err.message}`);
      }
    }
  }
}

console.log(`\n── 完了 ──`);
console.log(`  新規: ${totalNew}件`);
console.log(`  スキップ（既存）: ${totalSkipped}件`);
if (!skipAnalysis) {
  console.log(`  AI解析完了: ${totalAnalyzed}件`);
}
if (dryRun) {
  console.log(`  ※ dry-run モード（DB書き込みなし）`);
}
