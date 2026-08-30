# CLAUDE.md

## プロジェクト概要

水俣市（熊本県）向けの補助金AIスカウトシステム。jGrants APIで「全国」+「熊本県」の補助金を毎日自動収集し、Cloudflare Workers AIで水俣市への適合度を評価する。Cloudflare完結（Workers + D1 + Queues + Cron Triggers）。

本番: https://minamata-grant-scout.yyymkto.workers.dev

## 技術スタック

- cf-starter テンプレートベース（認証・org・RBAC は全削除済み）
- React + Tailwind v4 + TanStack Query / Hono / D1 + Drizzle
- Cloudflare Queues（非同期ジョブ）+ Cron Triggers（定期実行）
- AI: Cloudflare Workers AI (Llama 3.3 70B / Qwen 2.5 72B 等) primary / OpenAI GPT-4o-mini・Kimi K2.5 fallback

## 開発コマンド

```bash
npm run dev              # ローカル開発サーバー
npm run build            # ビルド
npm run deploy           # ビルド + デプロイ
npm run db:migrate       # D1マイグレーション（ローカル）
npm run db:migrate:remote # D1マイグレーション（リモート）
npm run ingest           # ローカルCLIで補助金取り込み（レガシー）
```

## 自動 ingest パイプライン（本番）

```
Cron (0 21 * * * = JST 6:00)
  → ingestGrantList(): jGrants API一覧取得 → D1保存 → Queue投入
  → grant.fetch_detail: 詳細取得 → raw_text・省庁名をD1更新
  → grant.analyze: AI解析（Workers AI → OpenAI → Kimi fallback）→ Zodバリデーション → D1保存
```

手動トリガー: `POST /api/grants/ingest`（x-admin-secret ヘッダ必須）

## DB構造

### grants テーブル
- id, title, source_ministry, source_url, published_at, deadline, raw_text, category_raw

### grant_ai_analyses テーブル
- grant_id (FK → grants.id)
- summary_short, support_type, target_entities, max_amount, subsidy_rate
- eligible_themes, required_documents, notes
- ai_confidence, minamata_fit_rank (A/B/C), minamata_fit_score (0-100)
- minamata_fit_reason, suggested_department, suggested_department_reason, minamata_use_case
- minamata_categories（カンマ区切り: 農業,漁業,旅館・観光 等）

## API エンドポイント

| エンドポイント | 内容 |
|---|---|
| `GET /api/grants` | 一覧（フィルタ: rank, category, q, include_ended） |
| `GET /api/grants/status` | ステータス（件数・最終更新） |
| `GET /api/grants/:id` | 詳細 + AI解析 |
| `POST /api/grants/ingest` | 手動ingest（要 x-admin-secret） |

デフォルトでCランク除外、締切済み除外（include_ended=trueで過去90日分表示）。

## ディレクトリ構成

- `app/` — React SPA（pages/grants/, hooks/, components/）
- `src/` — Worker backend
  - `src/features/grants/` — ingestパイプライン（TS移植版）
    - `minamata-profile.ts` — 水俣市プロファイル（AI解析のコンテキスト）
  - `src/routes/grants.ts` — API
  - `src/index.ts` — Worker entry（fetch + scheduled + queue）
- `scripts/` — ローカルCLI（レガシー、引き続き使用可）
- `migrations/` — D1マイグレーション

## jGrants API の注意点

- パラメータはフラットなクエリパラメータ（OpenAPI仕様のオブジェクト型ではない）
- `keyword`, `acceptance`, `sort`, `order` の4つが必須
- 対象地域は `TARGET_AREAS = ["全国", "熊本県"]`（`src/features/grants/jgrants-source.ts`）
- 省庁名はAPIに専用フィールドがない → v2詳細HTMLから抽出（62%ヒット）

## AI 解析の注意点

- Cloudflare Workers AI（複数モデルを順に試行）→ OpenAI GPT-4o-mini → Kimi K2.5 の順にフォールバック
- 評価ルーブリック・水俣市プロファイルは `src/features/grants/analyzer.ts` の `SYSTEM_PROMPT` と `minamata-profile.ts` を参照
- reasoning_contentフォールバック + ブレース対応JSONパーサーで安定抽出
- AI出力はZodスキーマでバリデーション（不正な型・範囲はデフォルト値にフォールバック）
- 外部API呼び出しにAbortSignal.timeout設定（jGrants: 15s, LLM: 30s）
- Queue handlerはON CONFLICT DO NOTHINGで冪等（at-least-once配信に対応）
- `.dev.vars` に `OPENAI_API_KEY`, `KIMI_API_KEY`, `ADMIN_SECRET` を設定（Workers AIはCloudflareバインディングのため鍵不要）

## シークレット

```bash
wrangler secret put OPENAI_API_KEY   # GPT-4o-mini fallback（任意）
wrangler secret put KIMI_API_KEY     # Kimi K2.5 fallback（任意）
wrangler secret put ADMIN_SECRET
```
