# CLAUDE.md

## 役割

- Claude Code は**設計担当**。既存コード・実データを確認した上で設計し、
  `docs/agent-notes/design-specs/YYYY-MM-DD_機能名.md` に設計書を書く
  （`design-specs/TEMPLATE.md` の型に従う）。
- 実装は Antigravity が担当する（`AGENTS.md` を読む）。ただし、バグ修正・調査・
  レビューなど設計書を挟むほどでない作業は Claude Code が直接行ってよい。
- Antigravity が設計書の「実装時の疑問点・ブロッカー」欄に追記した内容と、
  実際の実装差分を読んで、設計を修正するか実装を直すのも Claude Code の役割。

## 最初に読むもの

1. **`docs/agent-notes/CURRENT_STATUS.md`** ← 必読。プロジェクトの「今」の状態。
   これだけ読めば、他のエージェント（Antigravity等）との認識ズレを防げます。
2. 着手前に `docs/agent-notes/design-specs/` に該当機能の設計書がないか確認する。
3. 詳しい経緯を知りたい場合のみ `docs/agent-notes/decisions-log/` を参照。

## 運用ルール

- **状態の変更を伴う作業をしたら、必ず `CURRENT_STATUS.md` を更新すること。**
- 大きな設計判断をしたら、`decisions-log/` に日付つきで1ファイル追記する
  （このファイル自体は上書きせず、追記のみ）。
- `docs/agent-notes/design-specs/` にある設計書と実装内容が食い違う場合、
  無断で設計を変更・省略しない。疑問点として設計書に追記し、作業を止めて確認する。

## プロジェクト概要

水俣市（熊本県）向けの補助金AIスカウトシステム。jGrants API（「全国」+「熊本県」の国の補助金）と熊本県公式サイトRSS（県独自の補助金、jGrantsには載らない）の2系統から毎日自動収集し、Cloudflare Workers AIで水俣市への適合度を評価する。Cloudflare完結（Workers + D1 + Queues + Cron Triggers）。

本番: https://minamata-grant-scout.yyymkto.workers.dev

## 技術スタック

- cf-starter テンプレートベース（認証・org・RBAC は全削除済み）
- React + Tailwind v4 + TanStack Query / Hono / D1 + Drizzle
- Cloudflare Queues（非同期ジョブ）+ Cron Triggers（定期実行）
- AI: Cloudflare Workers AI (qwen3-30b-a3b-fp8 primary / llama-3.1-8b・llama-3.3-70b fallback) primary / Gemini・OpenAI GPT-4o-mini・Kimi K2.5 fallback

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
  → ingestGrantList(): jGrants API + 熊本県公式サイトRSS一覧取得 → D1保存 → Queue投入
  → grant.fetch_detail: 詳細取得（source="jgrants"→jGrants API detail / source="kumamoto_pref"→記事ページscrape）
    → raw_text・省庁名をD1更新
  → grant.analyze: AI解析（Workers AI → OpenAI → Kimi fallback）→ Zodバリデーション → D1保存
```

手動トリガー:
- `POST /api/grants/ingest`（x-admin-secret ヘッダ必須）— 新規取得
- `POST /api/grants/reanalyze`（x-admin-secret ヘッダ必須、body `{ ids?: number[] }`）— 既存データの再解析

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
| `POST /api/grants/reanalyze` | 既存データの再解析（要 x-admin-secret、body `{ ids?: number[] }`） |

デフォルトでCランク除外、締切済み除外（include_ended=trueで過去90日分表示）。

## ディレクトリ構成

- `app/` — React SPA（pages/grants/, hooks/, components/）
- `src/` — Worker backend
  - `src/features/grants/` — ingestパイプライン（TS移植版）
    - `jgrants-source.ts` — jGrants APIクライアント
    - `kumamoto-pref-source.ts` — 熊本県公式サイトRSSクライアント（県独自制度）
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
- **jGrantsは国（全省庁）の補助金のみ。熊本県庁・水俣市役所が独自財源で実施する補助金は載っていない**

## 熊本県公式サイトRSS（kumamoto-pref-source.ts）の注意点

- 対象15部署（商工・農林水産・エネルギー・環境・観光に加え、2026-09に福祉・医療・子ども系7課を追加: 高齢者支援課・社会福祉課・障がい者支援課・医療政策課・国保高齢者医療課・健康づくり推進課・子ども未来課）のRSS URLは `/rss/10/soshiki-{部グループ番号}-{組織番号}.xml`。部グループ番号は組織番号と一致しないため、実URLは各部署ページのHTMLから個別に確認したもの（ハードコード済み、`KUMAMOTO_PREF_FEEDS`）。なお「病院局」は病院運営組織で補助金情報の発信元として不向きなため対象外とした
- 部署の再編でRSS URL・部署名が変わることがある（実装時に3/8部署でGeminiの事前調査と実際の部署名が食い違っていた）。定期的な検証を推奨
- タイトルに「補助金|助成金|支援金|給付金|公募|交付金」を含み、「募集終了|受付終了|終了しました」を含まない記事のみ抽出
- 記事本文は `id="main_body"` 〜 `id="content_footer"` の間のみ抽出（ヘッダー・フッター等のノイズ除外）
- PDF内のみに記載された詳細条件（補助率・上限額等）はテキスト抽出していない（MVP時点では見送り。本文にリンクとして残る）
- Cloudflare Workers無料プランのsubrequest上限（50件/呼び出し）を踏まえ、一覧取得（RSS 8件）と本文取得（Queue経由で1件ずつ）を分離している

## AI 解析の注意点

- Cloudflare Workers AI（複数モデルを順に試行）→ Google Gemini（AI Studio無料枠）→ OpenAI GPT-4o-mini → Kimi K2.5 の順にフォールバック
- 評価は「LLM分類 + 決定論的スコア計算」のハイブリッド方式。LLMは産業・政策テーマ・水俣固有性タグへの分類のみ行い（`src/features/grants/analyzer.ts` の `SYSTEM_PROMPT`）、0〜100点のスコアとA/B/Cランクは `src/features/grants/minamata-scoring-profile.ts` の決定論的ロジックで自動計算する。地域プロファイルの数値根拠は `minamata_research_files/`（YAML・Python参照実装・設計メモ）を参照。市の定性的なプロフィール文章は `minamata-profile.ts`
- reasoning_contentフォールバック + ブレース対応JSONパーサーで安定抽出
- AI出力はZodスキーマでバリデーション（不正な型・範囲はデフォルト値にフォールバック）
- 外部API呼び出しにAbortSignal.timeout設定（jGrants: 15s, LLM: 30s）
- Queue handlerはON CONFLICT DO NOTHINGで冪等（at-least-once配信に対応）
- `.dev.vars` に `GEMINI_API_KEY`, `OPENAI_API_KEY`, `KIMI_API_KEY`, `ADMIN_SECRET` を設定（Workers AIはCloudflareバインディングのため鍵不要）
- **Workers AIは無料枠が1日1万ニューロンしかなく、大量投入時はすぐ枯渇する。Queueにdead letter未設定のため、全フォールバックが失敗したジョブは3回リトライ後に消える。** そのため cron のたびに `queueUnanalyzedBacklog()`（`src/features/grants/ingest.ts`）が未解析分を少しずつ（デフォルト30件）再キュー投入し、自己修復する。フォールバック鍵（特にGemini）を設定しておくとほぼ即座に解消する。

## シークレット

```bash
wrangler secret put GEMINI_API_KEY   # Gemini 2.0 Flash fallback（推奨・無料枠あり、Googleアカウントのみで取得可: https://aistudio.google.com/apikey）
wrangler secret put OPENAI_API_KEY   # GPT-4o-mini fallback（任意）
wrangler secret put KIMI_API_KEY     # Kimi K2.5 fallback（任意）
wrangler secret put ADMIN_SECRET
```
