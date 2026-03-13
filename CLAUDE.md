# CLAUDE.md

## プロジェクト概要

太良町（佐賀県）向けの補助金AIスカウトシステム。jGrants APIで全省庁の補助金を毎日自動収集し、Kimi K2.5で太良町への適合度を評価する。Cloudflare完結（Workers + D1 + Queues + Cron Triggers）。

本番: https://tara-grant-scout.ichevi.workers.dev

## 技術スタック

- cf-starter テンプレートベース（認証・org・RBAC は全削除済み）
- React + Tailwind v4 + TanStack Query / Hono / D1 + Drizzle
- Cloudflare Queues（非同期ジョブ）+ Cron Triggers（定期実行）
- AI: Kimi K2.5 (Moonshot AI, OpenAI互換API)

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
  → grant.analyze: Kimi K2.5解析 → grant_ai_analysesに保存
```

手動トリガー: `POST /api/grants/ingest`（x-admin-secret ヘッダ必須）

## DB構造

### grants テーブル
- id, title, source_ministry, source_url, published_at, deadline, raw_text, category_raw

### grant_ai_analyses テーブル
- grant_id (FK → grants.id)
- summary_short, support_type, target_entities, max_amount, subsidy_rate
- eligible_themes, required_documents, notes
- ai_confidence, tara_fit_rank (A/B/C), tara_fit_score (0-100)
- tara_fit_reason, suggested_department, suggested_department_reason, tara_use_case
- tara_categories（カンマ区切り: 農業,漁業,林業,旅館・観光 等）

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
  - `src/routes/grants.ts` — API
  - `src/index.ts` — Worker entry（fetch + scheduled + queue）
- `scripts/` — ローカルCLI（レガシー、引き続き使用可）
- `migrations/` — D1マイグレーション

## jGrants API の注意点

- パラメータはフラットなクエリパラメータ（OpenAPI仕様のオブジェクト型ではない）
- `keyword`, `acceptance`, `sort`, `order` の4つが必須
- 省庁名はAPIに専用フィールドがない → v2詳細HTMLから抽出（62%ヒット）

## AI 解析の注意点

- `thinking: { type: "disabled" }` でInstant Mode
- reasoning_contentフォールバック + ブレース対応JSONパーサーで安定抽出
- `.dev.vars` に `KIMI_API_KEY` と `ADMIN_SECRET` を設定

## シークレット

```bash
wrangler secret put KIMI_API_KEY
wrangler secret put ADMIN_SECRET
```
