# エージェント間情報共有の仕組み：使い方

Claude Code・Antigravity・claude.ai（ブラウザ経由の設計担当）など、複数のAIツールで
このプロジェクトを進めるにあたり、「誰かが一歩古い状態を把握したまま指示を出す」
というズレを防ぐための最小限の仕組みです（`minamata-support-portal`で運用実績のある
仕組みをこのプロジェクトにも移植したもの）。

## ファイル構成

```
CLAUDE.md                              ← Claude Codeが自動で読む起点ファイル
AGENTS.md                              ← Antigravityが自動で読む起点ファイル
docs/agent-notes/
├── CURRENT_STATUS.md                  ← 常に最新の状態（上書き運用）
├── design-specs/                      ← Claude（設計）→Antigravity（実装）の受け渡し用
│   ├── TEMPLATE.md                    ← 新しい設計書を書く時のひな形
│   └── YYYY-MM-DD_機能名.md           ← 個別機能の設計書（実装完了後も残す）
└── decisions-log/
    ├── TEMPLATE.md                    ← 新しい決定を記録する時のひな形
    └── YYYY-MM-DD_件名.md             ← 決定の記録（追記専用、削除しない）
```

`design-specs/` と `decisions-log/` の違い：
- `design-specs/` は**実装前**に書く、これから作るものの仕様書（概要・データ構造・
  画面/API仕様・タスク一覧）。
- `decisions-log/` は**決まった後**に書く、なぜその設計にしたかの記録。

## claude.ai（設計担当）との連携フロー

1. 大きめの機能は、claude.aiのプロジェクト機能でClaudeに設計を依頼する
   （役割は設計のみ、実装コードは書かない）。
2. Claudeが`design-specs/TEMPLATE.md`の型で設計書を書く。
3. 人間がその出力をコピーし、`docs/agent-notes/design-specs/YYYY-MM-DD_機能名.md`
   として保存する（claude.aiは直接リポジトリを読み書きできないため）。
4. Antigravity（実装担当）がこの設計書に従って実装する。
   **食い違いや不足を見つけても無断で仕様を変えず、設計書に疑問点を追記した上で
   作業を止めて報告する。**
5. 実装完了後、設計書の「状態」を更新し、`CURRENT_STATUS.md`にも反映する。
   大きな判断があれば`decisions-log/`にも記録する。

## 使い方（3ルールだけ）

### 1. 作業を始める前に `CURRENT_STATUS.md` を読む
Claude Codeなら`CLAUDE.md`経由で、Antigravityなら`AGENTS.md`経由で自動的に
案内される。

### 2. 何か決めたら、その場で `CURRENT_STATUS.md` を上書きする
「後でまとめて更新しよう」はほぼ確実に忘れる。決めたその場で、ファイル冒頭の
日時と更新者を書き換えて、該当セクションを直す。

### 3. 大きな決定は `decisions-log/` にも残す
`CURRENT_STATUS.md`は「今」の状態だけなので、**なぜそうなったか**はすぐ
消えてしまう。あとから「なぜこの設計にしたんだっけ」となりそうな決定は、
`TEMPLATE.md`をコピーして1ファイル追記する。
