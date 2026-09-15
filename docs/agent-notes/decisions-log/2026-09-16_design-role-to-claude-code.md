# [2026-09-16] 設計担当をclaude.aiからClaude Codeに変更

**決めた人/エージェント**: 吉野さん（Claude Codeのレビューを受けて）
**関係者**: 吉野さん、Claude Code

## 背景・課題

前日（2026-09-15）に「claude.aiのClaude＝設計、Antigravity＝実装」という分担で
仕組みを導入したが、レビューの結果、次の構造的な弱点が明らかになった。

- claude.aiはリポジトリを読めないため、既存コードやデータの実態に基づいた設計が
  できない。存在しないファイル名や既にあるフィールドを前提にした設計書が出うる。
- Antigravityが設計書の「実装時の疑問点」欄に書いた内容を、claude.aiは自力で
  読めない。実装差分のレビューもできない。結果、フィードバックの往復がすべて
  人間のコピペ頼みになり、ここが仕組みの最も壊れやすい部分になっていた。
- `minamata-support-portal`の実績を見ると、価値を生んでいた設計作業の大半
  （実HTMLの調査、文字化けの生バイト確認、429応答本文の確認、jsdomでの検証、
  Antigravity実装の致命的バグ2件の発見）は、いずれもリポジトリとデータに
  アクセスできなければ不可能なものだった。

## 決定内容

- **設計担当をClaude Codeに変更する。** Claude Codeは既存コード・実データを
  確認した上で設計し、`docs/agent-notes/design-specs/`に直接書き込む。
  Antigravityが書いた疑問点と実装差分もClaude Codeが直接読み、設計を修正する。
  これによりループが人間のコピペなしで閉じる。
- **claude.aiは外側に残し、「リポジトリを読めなくても成立する企画・戦略の
  壁打ち」に限定する**（評価軸の妥当性、届け方、収集対象の拡張方針、優先順位など）。
  出た方針は人間がClaude Codeに引き渡して設計書に落とし込む。
- `AGENTS.md`・`CLAUDE.md`・`docs/agent-notes/README.md`・
  `claude-ai-project-instructions.md`・`design-specs/TEMPLATE.md`の記述を
  この分担に合わせて更新した。

## 却下した選択肢（あれば）

- claude.aiを設計担当のまま維持する案 → スマホから気軽に壁打ちできる利点はあるが、
  フィードバックの往復が人間のコピペ頼みになる代償が大きいと判断。企画レベルの
  壁打ち用途としては残すため、利点は完全には失われない。

## 影響を受けるファイル

- `AGENTS.md`
- `CLAUDE.md`
- `docs/agent-notes/README.md`
- `docs/agent-notes/CURRENT_STATUS.md`
- `docs/agent-notes/claude-ai-project-instructions.md`
- `docs/agent-notes/design-specs/TEMPLATE.md`
