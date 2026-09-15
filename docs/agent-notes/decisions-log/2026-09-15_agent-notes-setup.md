# [2026-09-15] agent-notes運用（CURRENT_STATUS/design-specs/decisions-log）の導入

**決めた人/エージェント**: Claude（吉野さんの依頼）
**関係者**: 吉野さん

## 背景・課題

吉野さんが、claude.aiで設計だけを行うClaudeと、実装を行うAntigravityの分担を
複数プロジェクトで運用する方針を決めた。互いの会話を見られない2つのAIエージェント間の
「受け渡し」をリポジトリ内のファイルで行うことにし、`minamata-support-portal`で
既に運用実績のあった仕組み（`CURRENT_STATUS.md`・`decisions-log/`・`AGENTS.md`）を
このプロジェクトにも導入することにした。加えて、実装前の「これから作るものの仕様」を
渡すフォーマットが無かったため、`design-specs/`を新設した。

## 決定内容

- `docs/agent-notes/`を新設（`README.md`・`CURRENT_STATUS.md`・`design-specs/TEMPLATE.md`・
  `decisions-log/TEMPLATE.md`）。
- `AGENTS.md`をルートに新規作成（Antigravity向け、実装専任・設計書に従う・食い違いは
  無断で変更せず報告する、というルールを明記）。
- 既存の`CLAUDE.md`（Claude Code向け、技術詳細を多く含む）はそのまま残し、先頭に
  「最初に読むもの」「運用ルール」節を追加してagent-notesへの導線を作った。

## 却下した選択肢（あれば）

- `CLAUDE.md`の内容を全面的に`AGENTS.md`と同一構成に作り直す案 → 既存の技術詳細
  （jGrants APIの注意点・DB構造等）はClaude Code利用時に有用なため、そのまま残し
  冒頭のみ共通化する形にした。

## 影響を受けるファイル

- `AGENTS.md`（新規）
- `CLAUDE.md`
- `docs/agent-notes/README.md`（新規）
- `docs/agent-notes/CURRENT_STATUS.md`（新規）
- `docs/agent-notes/design-specs/TEMPLATE.md`（新規）
- `docs/agent-notes/decisions-log/TEMPLATE.md`（新規）

---
※ このファイルをコピーして `docs/agent-notes/decisions-log/YYYY-MM-DD_短い件名.md` として保存してください。
※ 決定したら `CURRENT_STATUS.md` の該当箇所も更新すること。
