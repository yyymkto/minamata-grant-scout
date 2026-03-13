# 補助金スカウト @太良

太良町向け補助金AI発見システム。全省庁の補助金情報を毎日自動収集し、AIが太良町との相性を判定・スコアリングする。

**https://tara-grant-scout.ichevi.workers.dev**

## アーキテクチャ

```
Cron Trigger (毎日 JST 6:00)
  → jGrants API から一覧取得 → D1 に新規保存 → Queue 投入

Queue Consumer
  → grant.fetch_detail: 詳細取得 → D1 更新
  → grant.analyze: Kimi K2.5 で AI 解析 → D1 に結果保存

Web UI (React SPA)
  → GET /api/grants → フィルタ付き一覧表示
  → GET /api/grants/:id → 詳細 + AI 解析結果
```

Cloudflare 完結（Workers + D1 + Queues + Cron Triggers）。外部依存は jGrants API と LLM API（Kimi K2.5 / GPT-4o-mini）のみ。

## スタック

| レイヤー | 技術 |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS v4 + TanStack Query |
| Backend | Hono on Cloudflare Workers |
| Database | D1 (SQLite) + Drizzle ORM |
| 非同期処理 | Cloudflare Queues |
| 定期実行 | Cron Triggers |
| AI 解析 | Kimi K2.5 (Moonshot AI) / GPT-4o-mini (fallback) |
| データソース | jGrants API (デジタル庁) |
| Build | Vite + @cloudflare/vite-plugin |

## クイックスタート

```bash
npm install
npm run db:migrate
npm run dev
```

`http://localhost:5173` で一覧が見れる（認証不要）。

## データ取り込み

### 自動（本番）

Cron Trigger が毎日 JST 6:00 に自動実行。新規補助金を検出 → Queue 経由で詳細取得 → AI 解析。

### 手動トリガー

```bash
# リモートで手動ingest
curl -X POST -H "x-admin-secret: $ADMIN_SECRET" \
  https://tara-grant-scout.ichevi.workers.dev/api/grants/ingest
```

### ローカル CLI（レガシー、引き続き使用可）

```bash
npm run ingest                    # 取得 + AI解析
npm run ingest -- --skip-analysis # 取得のみ
npm run ingest -- --analyze-only  # 未解析分のみAI解析
npm run ingest -- --remote        # リモートD1に書き込み
```

## AI 解析

各補助金に対して Kimi K2.5（フォールバック: GPT-4o-mini）が以下を生成：

| フィールド | 内容 |
|---|---|
| `tara_fit_rank` | A（有望）/ B（検討余地あり）/ C（関連薄い） |
| `tara_fit_score` | 0〜100 の適合スコア |
| `tara_fit_reason` | 太良町への適合理由 |
| `tara_use_case` | 太良町での具体的な活用仮説 |
| `tara_categories` | カテゴリ分類（農業、漁業、林業、旅館・観光 等） |
| `summary_short` | 2〜3 文の要約 |
| `max_amount` | 補助額上限 |

UI ではデフォルトで A・B ランクのみ表示（C は除外）。

## API

| エンドポイント | 内容 |
|---|---|
| `GET /api/grants` | 一覧（フィルタ: `rank`, `category`, `q`, `include_ended`） |
| `GET /api/grants/status` | ステータス（件数・最終更新日時） |
| `GET /api/grants/:id` | 詳細 + AI 解析結果 |
| `POST /api/grants/ingest` | 手動 ingest トリガー（要 `x-admin-secret`） |
| `GET /api/health` | ヘルスチェック |

## ディレクトリ構成

```
tara-grant-scout/
├── app/                          React UI
│   ├── components/AppShell.tsx   レイアウト + フッター
│   ├── hooks/useGrants.ts        データフック
│   └── pages/grants/             一覧・詳細ページ
├── src/                          Worker backend
│   ├── features/grants/          ingest パイプライン (TS)
│   │   ├── jgrants-source.ts     jGrants API クライアント
│   │   ├── analyzer.ts           Kimi K2.5 AI 解析
│   │   ├── ingest.ts             オーケストレータ
│   │   ├── json-parser.ts        LLM 出力パーサー
│   │   └── tara-profile.ts       太良町プロファイル
│   ├── db/schema.ts              Drizzle schema
│   ├── routes/grants.ts          補助金 API
│   └── index.ts                  Worker entry (fetch + cron + queue)
├── scripts/                      ローカル CLI (レガシー)
│   ├── ingest.mjs
│   ├── sources/jgrants.mjs
│   └── lib/analyzer.mjs
└── migrations/                   D1 マイグレーション
```

## デプロイ

```bash
# シークレット設定（初回のみ）
wrangler secret put KIMI_API_KEY
wrangler secret put OPENAI_API_KEY   # GPT-4o-mini fallback（任意）
wrangler secret put ADMIN_SECRET

# マイグレーション + デプロイ
npm run db:migrate:remote
npm run deploy
```

