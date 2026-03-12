# CLAUDE.md

## プロジェクト概要

太良町（佐賀県）向けの補助金AI発見システム。jGrants API + 省庁スクレイパーで補助金情報を収集し、AIで太良町への適合度を評価する。

## 技術スタック

- cf-starter テンプレートベース（React + Hono + D1 + Drizzle）
- 認証は無効化済み（`grants.ts`の`requireAuth`を削除、`App.tsx`の`AuthGuard`を削除）
- フロントエンドは認証なしで直接アクセス可能

## 開発コマンド

```bash
npm run dev          # ローカル開発サーバー
npm run db:migrate   # D1マイグレーション適用
npm run ingest       # 補助金データ取り込み
```

## DB構造（補助金関連）

### grants テーブル
- id, title, source_ministry, source_url, published_at, deadline, raw_text, category_raw

### grant_ai_analyses テーブル
- grant_id (FK → grants.id)
- summary_short, support_type, target_entities, max_amount, subsidy_rate
- eligible_themes, required_documents, notes
- ai_confidence, tara_fit_rank (A/B/C), tara_fit_score (0-100)
- tara_fit_reason, suggested_department, suggested_department_reason, tara_use_case

## ingestパイプライン

`scripts/ingest.mjs` がソースプラグイン（`scripts/sources/*.mjs`）を動的ロードして実行。

各プラグインは `export const label` と `export async function fetchGrants()` をエクスポートする。

### jGrants API の注意点

- エンドポイント: `https://api.jgrants-portal.go.jp/exp/v1/public/subsidies`
- パラメータはフラットなクエリパラメータで渡す（OpenAPI仕様のオブジェクト型`request`ではない）
- `keyword`, `acceptance`, `sort`, `order` の4つが必須
- `wrangler`はグローバルにないので`npx wrangler`で呼ぶ（spawnSyncでも同様）
- raw_textが長いとシェル引数上限に引っかかるので2000文字に切り捨て

## 太良町プロファイル

`scripts/lib/tara-profile.mjs` に定義。AI解析のプロンプトに使用。

- 人口約8,000人、高齢化率40%超
- 基幹産業: みかん、牡蠣、林業
- 町役場部署: 企画商工課、農林水産課、建設課、町民福祉課、教育委員会

## 既知の課題

- AI解析にAPIキーが未設定（`scripts/lib/analyzer.mjs`）。現状はClaude Code内のCodexに手動で投げて結果をDB投入
- jGrantsから取得した67件中55件がまだAI解析未実施
- `scripts/sources/e-gov.mjs` はスタブ（空配列を返す）
- cf-starterの認証・org機能のコードは残っているが使っていない
