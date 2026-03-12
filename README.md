# tara-grant-scout

太良町向け補助金AI発見システム。全省庁の補助金情報を自動収集し、太良町への適合度をAIで評価・スコアリングする。

## 概要

```
jGrants API（全省庁） ─┐
                       ├─→ D1保存 → AI解析 → スコア付き一覧（Web UI）
農水省スクレイパー ────┘
```

- **jGrants API**（デジタル庁）で全省庁の補助金を一括取得
- **農水省スクレイパー**で農林水産省の公募情報を直接取得
- AIが太良町の視点で適合度を A/B/C ランク評価（100点満点スコア付き）
- 担当部署の提案、活用シナリオの生成まで自動化

## スタック

| レイヤー | 技術 |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS v4 + TanStack Query |
| Backend | Hono on Cloudflare Workers |
| Database | D1 (SQLite) + Drizzle ORM |
| Build | Vite + `@cloudflare/vite-plugin` |
| データソース | jGrants API, 農水省 Web スクレイピング |

## クイックスタート

```bash
npm install
npm run db:migrate
npm run dev
```

`http://localhost:5173` でブラウザから一覧が見れる（認証不要）。

## 補助金データの取り込み

```bash
# jGrants（全省庁）から募集中の補助金を取得・保存
npm run ingest -- --source jgrants --skip-analysis

# 農水省から公募情報を取得・保存
npm run ingest -- --source maff --skip-analysis

# 全ソースから取得（AI解析付き）
npm run ingest
```

### ingest オプション

| オプション | 内容 |
|---|---|
| `--source <name>` | 特定ソースのみ（`jgrants`, `maff`） |
| `--skip-analysis` | AI解析をスキップ（取得・保存のみ） |
| `--dry-run` | DB書き込みなし（確認用） |
| `--remote` | リモートD1に書き込み |

## データソース

### jGrants API

デジタル庁が運営する補助金ポータルの公開API。全省庁の補助金を統合的に検索・取得できる。

- エンドポイント: `https://api.jgrants-portal.go.jp/exp/v1/public/subsidies`
- 認証不要
- 検索条件: キーワード、地域（佐賀県 / 全国）、募集状態
- 詳細取得: v2エンドポイントで事業概要テキストも取得

### 農水省スクレイパー

`https://www.maff.go.jp/j/supply/hozyo/` の公募一覧テーブルをスクレイピング。和暦日付の変換、相対URLの解決を含む。

## AI解析

各補助金に対して以下を生成：

| フィールド | 内容 |
|---|---|
| `tara_fit_rank` | A（有望）/ B（検討の余地あり）/ C（関連薄い） |
| `tara_fit_score` | 0〜100の適合スコア |
| `tara_fit_reason` | 太良町への適合理由 |
| `suggested_department` | 担当部署（企画商工課、農林水産課 等） |
| `tara_use_case` | 太良町での具体的な活用シナリオ |
| `summary_short` | 事業の要約 |
| `support_type` | 補助金 / 交付金 / 助成金 |
| `target_entities` | 対象者 |

太良町プロファイル（`scripts/lib/tara-profile.mjs`）に基づいて評価：
- 人口約8,000人、高齢化率40%超の過疎地域
- 基幹産業: みかん（竹崎みかん）、牡蠣（竹崎牡蠣）、林業
- 課題: 人口減少、担い手不足、デジタル化の遅れ

## API

| エンドポイント | 内容 |
|---|---|
| `GET /api/grants` | 補助金一覧（フィルタ: `rank`, `ministry`, `department`, `q`） |
| `GET /api/grants/:id` | 補助金詳細 + AI解析結果 |

## ディレクトリ構成

```text
tara-grant-scout/
├── app/                     React UI
│   ├── hooks/useGrants.ts   補助金データフック
│   └── pages/grants/        一覧・詳細ページ
├── src/                     Worker backend
│   ├── db/schema.ts         Drizzle schema（grants, grant_ai_analyses）
│   └── routes/grants.ts     補助金API
├── scripts/
│   ├── ingest.mjs           取り込みパイプライン
│   ├── sources/
│   │   ├── jgrants.mjs      jGrants APIプラグイン
│   │   └── maff.mjs         農水省スクレイパー
│   └── lib/
│       ├── analyzer.mjs     AI解析エンジン
│       └── tara-profile.mjs 太良町プロファイル
├── migrations/
│   └── 0011_grants.sql      grants + grant_ai_analyses テーブル
└── tmp/                     一時ファイル（分析結果JSON等）
```

## デプロイ

```bash
# リモートD1にmigration適用
npm run db:migrate:remote

# デプロイ
npm run deploy

# リモートDBにデータ投入
npm run ingest -- --remote --skip-analysis
```
