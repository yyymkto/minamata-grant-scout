# このプロジェクトについて（AIエージェント向け）

このファイルは Antigravity（および AGENTS.md 対応の各種ツール）が
作業開始時に自動で読み込みます。Claude Code を使う場合は同内容を含む
`CLAUDE.md` が同じ役割を果たします。

## 役割

- あなたは実装担当。設計は `docs/agent-notes/design-specs/` 以下の設計書に従う
  （設計担当はclaude.aiのClaude。実装コードは書かず設計書のみを作る運用）。
- 設計書にない仕様変更やライブラリ追加を独断で行わない。
- 設計書に矛盾・不足があれば、実装を止めて疑問点として設計書ファイルに追記し、報告する。

## 最初に読むもの

1. **`docs/agent-notes/CURRENT_STATUS.md`** ← 必読。プロジェクトの「今」の状態。
2. 実装前に `docs/agent-notes/design-specs/` に該当機能の設計書がないか確認する。
   ある場合はそれに従う。
3. 詳しい経緯を知りたい場合のみ `docs/agent-notes/decisions-log/` を参照。
4. プロジェクト全体の技術詳細（DB構造・API・注意点）は `CLAUDE.md` を参照。

## プロジェクト概要

水俣市向け補助金AI発見システム。国（全省庁）と熊本県独自の補助金情報を毎日自動収集し、
AIが水俣市との相性を判定・スコアリングする。本番: https://minamata-grant-scout.yyymkto.workers.dev

## 技術スタック・開発コマンド

- React + TypeScript + Tailwind v4 + TanStack Query / Hono on Cloudflare Workers /
  D1 + Drizzle / Cloudflare Queues + Cron Triggers
- `npm run dev` — ローカル開発サーバー
- `npm run build` — ビルド
- `npm run db:migrate` — D1マイグレーション（ローカル）
- 詳細は `CLAUDE.md` を参照。

## 運用ルール

- **状態の変更を伴う作業をしたら、必ず `CURRENT_STATUS.md` を更新すること。**
  更新しないまま作業を終えると、次にこのファイルを読む人（人間もエージェントも）が
  古い情報のまま動いてしまう。
- 大きな設計判断をしたら、`decisions-log/` に日付つきで1ファイル追記する
  （このファイル自体は上書きせず、追記のみ）。
- **`docs/agent-notes/design-specs/` にある設計書と実装内容が食い違う場合、
  無断で設計を変更・省略しない。** 疑問点として設計書の該当ファイルに追記し、
  作業を止めて人間（または設計担当のClaude）に確認する。
- ファイル形式はMarkdown固定。他のエージェント・人間も読めるように。
