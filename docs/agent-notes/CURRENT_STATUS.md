# 現在の状態（最終更新：2026-09-15 by Claude）

> このファイルは常に「今の状態」を反映するよう **上書き更新** します。
> 過去の経緯を追いたい場合は `decisions-log/` を見てください。
> 更新したら、一番上の日時と更新者を必ず書き換えること。

## 今どのフェーズか

- 本番稼働中: https://minamata-grant-scout.yyymkto.workers.dev
- データ収集は2系統（jGrants API＋熊本県公式サイトRSS）とも稼働中。
  熊本県RSSの対象部署は2026-09に福祉・医療・子ども系7課を追加し15部署体制になった。
- AI評価は「LLM分類＋決定論的スコア計算」のハイブリッド方式（`feature/rubric-hybrid-scoring`、
  2026-09-01にmainへマージ済み）に刷新済み。以後、本番データ検証で見つかった
  配点バグ・AI分類崩壊・キー誤爆・Geminiフォールバックの廃止済みモデル指定を
  順次修正済み（直近コミットは2026-09-13）。
- 評価ロジックの解説ページ（`/grants/about-scoring`）を追加済み。
- **本日、Claude(設計)→Antigravity(実装)のファイル受け渡し運用
  （`docs/agent-notes/` 一式）をこのプロジェクトに新規導入した**
  （`minamata-support-portal`で運用実績のある仕組みを移植）。

## 確定している設計方針

- 国の補助金（jGrants、全省庁・全国+熊本県対象）と、熊本県独自の補助金
  （公式サイトRSS、jGrantsに載らない）は別ソースとして扱う。
- AI評価はLLMに点数を出させず、「産業・政策テーマ・水俣固有性タグへの分類」のみ
  LLMに行わせ、`src/features/grants/minamata-scoring-profile.ts`の決定論的ロジックで
  0〜100点のスコアとA/B/Cランクを計算する（配点モデルの一元管理）。
- UIはデフォルトでA・Bランクのみ表示（Cランク除外）。

## 現在のファイル構成（agent-notes関連のみ）

```
minamata-grant-scout/
├── docs/
│   └── agent-notes/           # 新規
│       ├── README.md
│       ├── CURRENT_STATUS.md
│       ├── design-specs/
│       │   └── TEMPLATE.md
│       └── decisions-log/
│           └── TEMPLATE.md
├── AGENTS.md                  # 新規（Antigravity向け）
├── CLAUDE.md                  # 既存（Claude Code向け、agent-notes運用ルールを追記）
└── README.md
```

その他の全体構成は `README.md` および `CLAUDE.md` を参照（Worker backend / React SPA /
migrations 等の詳細は変更なし）。

## 進行中のタスク

| タスク | 担当 | 状態 |
|---|---|---|
| 評価ルーブリックのハイブリッド化 | Claude | 完了（mainにマージ済み） |
| 本番データ検証での配点バグ・AI分類崩壊対策 | Claude | 完了 |
| Gemini fallbackモデルの廃止対応 | Claude | 完了 |
| agent-notes運用（design-specs/CURRENT_STATUS/decisions-log）の導入 | Claude | 完了（本日） |

## 未決定の論点（次に議論すべきこと）

- 特になし（本日の導入作業のみ。今後の機能追加はここに追記していく）。

## 直近の変更履歴（簡易、詳細はdecisions-log参照）

- 2026-09-15: [Claude] `minamata-support-portal`で運用中の「Claude(設計)→Antigravity
  (実装)をファイルで受け渡す」仕組みをこのプロジェクトにも新規導入。
  `docs/agent-notes/`（CURRENT_STATUS.md・design-specs/・decisions-log/）を新設し、
  `AGENTS.md`を新規作成、既存`CLAUDE.md`に「最初に読むもの」「運用ルール」節を追加した。
  詳細は`decisions-log/2026-09-15_agent-notes-setup.md`参照。
