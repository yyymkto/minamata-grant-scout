# 補助金スカウト @水俣

水俣市向け補助金AI発見システム。国（全省庁）と熊本県独自の補助金情報を毎日自動収集し、AIが水俣市との相性を判定・スコアリングする。

**https://minamata-grant-scout.yyymkto.workers.dev**

## アーキテクチャ

```
Cron Trigger (毎日 JST 6:00)
  → jGrants API（国・全省庁）+ 熊本県公式サイトRSS（県独自制度）から一覧取得
    → D1 に新規保存 → Queue 投入

Queue Consumer
  → grant.fetch_detail: 詳細取得（jGrantsはAPI、熊本県は記事本文をスクレイピング）→ D1 更新
  → grant.analyze: Cloudflare Workers AI で AI 解析 → D1 に結果保存

Web UI (React SPA)
  → GET /api/grants → フィルタ付き一覧表示
  → GET /api/grants/:id → 詳細 + AI 解析結果
```

Cloudflare 完結（Workers + D1 + Queues + Workers AI + Cron Triggers）。外部依存は jGrants API と熊本県公式サイト（任意で Gemini / OpenAI / Kimi API フォールバックも可能）。

## スタック

| レイヤー | 技術 |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS v4 + TanStack Query |
| Backend | Hono on Cloudflare Workers |
| Database | D1 (SQLite) + Drizzle ORM |
| 非同期処理 | Cloudflare Queues |
| 定期実行 | Cron Triggers |
| AI 解析 | Cloudflare Workers AI (Llama 3.3 70B / Qwen 2.5 72B) |
| データソース1 | jGrants API (デジタル庁、対象地域: 全国 + 熊本県) — 国の補助金 |
| データソース2 | 熊本県公式サイト RSS（15部署の新着情報） — 県独自の補助金 |
| Build | Vite + @cloudflare/vite-plugin |

## クイックスタート

```bash
npm install
npm run db:migrate
npm run dev
```

`http://localhost:5173` で一覧が見れる（認証不要）。ローカルでサンプルデータを試すには `npm run seed` で水俣市向けのサンプル補助金データを投入できる。

## データ取り込み

### 自動（本番）

Cron Trigger が毎日 JST 6:00 に自動実行。新規補助金を検出 → Queue 経由で詳細取得 → AI 解析。

### 手動トリガー

```bash
# リモートで手動ingest
curl -X POST -H "x-admin-secret: $ADMIN_SECRET" \
  https://minamata-grant-scout.yyymkto.workers.dev/api/grants/ingest
```

### ローカル CLI（レガシー、引き続き使用可）

```bash
npm run ingest                    # 取得 + AI解析
npm run ingest -- --skip-analysis # 取得のみ
npm run ingest -- --analyze-only  # 未解析分のみAI解析
npm run ingest -- --remote        # リモートD1に書き込み
```

## AI 解析（4軸ルーブリック評価・構造化サマリー）

各補助金に対して Workers AI（Llama 3.3 70B / Qwen 2.5 72B）が以下を生成：

| フィールド | 内容 |
|---|---|
| `minamata_fit_score` | 4軸ルーブリック採点（申請主体適格性:25点、産業合致度:35点、補助実効性:20点、実現性:20点）による 0〜100点 の適合スコア |
| `minamata_fit_rank` | スコアに基づく自動ランク判定: A（75点以上・有望）/ B（50〜74点・検討余地あり）/ C（49点以下・関連薄い） |
| `minamata_fit_reason` | 4軸評価に基づく水俣市への適合理由 |
| `minamata_use_case` | 水俣市の資源・課題を踏まえた具体的な活用仮説 |
| `minamata_categories` | カテゴリ分類（農業、漁業、旅館・観光、環境・エネルギー 等） |
| `summary_short` | 【対象】【使途】【補助】【アクション】の構造化サマリー |
| `max_amount` | 補助額上限 |

UI ではデフォルトで A・B ランクのみ表示（C は除外）。評価ルーブリックと水俣市プロファイルは `src/features/grants/analyzer.ts` の `SYSTEM_PROMPT` と `src/features/grants/minamata-profile.ts` で管理している。

## API

| エンドポイント | 内容 |
|---|---|
| `GET /api/grants` | 一覧（フィルタ: `rank`, `category`, `q`, `include_ended`） |
| `GET /api/grants/status` | ステータス（件数・最終更新日時） |
| `GET /api/grants/:id` | 詳細 + AI 解析結果 |
| `POST /api/grants/ingest` | 手動 ingest トリガー（要 `x-admin-secret`） |
| `POST /api/grants/reanalyze` | 既存データの再解析トリガー（要 `x-admin-secret`。body `{ ids?: number[] }` 省略時は全件） |
| `GET /api/health` | ヘルスチェック |

## ディレクトリ構成

```
minamata-grant-scout/
├── app/                          React UI
│   ├── components/AppShell.tsx   レイアウト + フッター
│   ├── hooks/useGrants.ts        データフック
│   └── pages/grants/             一覧・詳細ページ
├── src/                          Worker backend
│   ├── features/grants/          ingest パイプライン (TS)
│   │   ├── jgrants-source.ts        jGrants API クライアント（対象地域: 全国 + 熊本県）
│   │   ├── kumamoto-pref-source.ts  熊本県公式サイト RSS クライアント（県独自制度）
│   │   ├── analyzer.ts              Workers AI（+ Gemini/OpenAI/Kimi フォールバック）AI 解析
│   │   ├── ingest.ts                オーケストレータ
│   │   ├── json-parser.ts           LLM 出力パーサー
│   │   └── minamata-profile.ts      水俣市プロファイル
│   ├── db/schema.ts              Drizzle schema
│   ├── routes/grants.ts          補助金 API
│   └── index.ts                  Worker entry (fetch + cron + queue)
├── scripts/                      ローカル CLI (レガシー)
│   ├── ingest.mjs
│   ├── seed-grants.mjs           水俣市向けサンプルデータ投入
│   ├── sources/jgrants.mjs
│   └── lib/analyzer.mjs
└── migrations/                   D1 マイグレーション
```

## デプロイ

```bash
# 事前に Cloudflare で D1 データベースと Queue を作成し、
# wrangler.jsonc の database_id・queue 名を発行された値に更新してください

# シークレット設定（初回のみ）
wrangler secret put GEMINI_API_KEY   # Gemini 2.0 Flash fallback（推奨・無料枠あり）
wrangler secret put OPENAI_API_KEY   # GPT-4o-mini fallback（任意）
wrangler secret put KIMI_API_KEY     # Kimi K2.5 fallback（任意）
wrangler secret put ADMIN_SECRET

# マイグレーション + デプロイ
npm run db:migrate:remote
npm run deploy
```
