# 現在の状態（最終更新：2026-09-16 by Claude Code）

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
- **Claude Code(設計)↔Antigravity(実装)のファイル受け渡し運用
  （`docs/agent-notes/` 一式）をこのプロジェクトに新規導入した**
  （`minamata-support-portal`で運用実績のある仕組みを移植）。
  役割分担の詳細は `docs/agent-notes/README.md` を参照。

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

## 未決定の論点・既知の課題（次に議論すべきこと）

> 以下は`CLAUDE.md`に記載されている既知の制約を転記したもの。**実際に今どの程度
> 問題になっているかは未確認**なので、吉野さんの実感と突き合わせて要修正。

- **Workers AIの無料枠（1日1万ニューロン）が大量投入時にすぐ枯渇する。**
  Queueにdead letterを設定していないため、全フォールバックが失敗したジョブは
  3回リトライ後に消える。cronのたびに`queueUnanalyzedBacklog()`が未解析分を
  30件ずつ再キュー投入して自己修復する設計だが、根本的にはフォールバック鍵
  （特にGemini）の設定が前提。現在の解析漏れ件数は要確認。
- **熊本県公式サイトのRSS URL・部署名は、県の組織再編で変わる。**
  実装時点で3/8部署について事前調査と実際の部署名が食い違っていた。
  `KUMAMOTO_PREF_FEEDS`はハードコードのため、定期的な検証が必要。
  検証の仕組み（自動チェックを入れるか、手動で回すか）は未決定。
- **PDF内にのみ記載された詳細条件（補助率・上限額等）を抽出していない。**
  MVP時点で見送った判断。本文にはリンクとして残るため実用上は追える状態だが、
  スコア計算には反映されない。
- jGrantsの省庁名はAPIに専用フィールドがなく、v2詳細HTMLからの抽出で
  ヒット率62%に留まる。残り38%の扱いは未整理。
- ランク判定の精度（A/B/Cの閾値75点・50点が妥当か）は本番データで
  継続検証中。配点バグは2026-09に複数修正済みだが、再発監視は必要。

## 直近の変更履歴（簡易、詳細はdecisions-log参照）

- 2026-09-16: [Claude Code] 設計担当をclaude.aiからClaude Codeに変更した。
  claude.aiはリポジトリを読めないため、Antigravityが設計書に書いた疑問点の回収も
  実装差分のレビューも人間のコピペ頼みになる一方、Claude Codeなら両方とも直接
  読めてループが閉じるため。claude.aiは「リポジトリを読めなくても成立する企画・
  戦略の壁打ち」に限定して外側に残す。あわせて`CURRENT_STATUS.md`の
  「未決定の論点：特になし」が誤りだった点を修正（`CLAUDE.md`記載の既知の制約を
  転記。実態は要確認）。詳細は`decisions-log/2026-09-16_design-role-to-claude-code.md`参照。
- 2026-09-15: [Claude] `minamata-support-portal`で運用中の「設計と実装を
  ファイルで受け渡す」仕組みをこのプロジェクトにも新規導入。
  `docs/agent-notes/`（CURRENT_STATUS.md・design-specs/・decisions-log/）を新設し、
  `AGENTS.md`を新規作成、既存`CLAUDE.md`に「最初に読むもの」「運用ルール」節を追加した。
  詳細は`decisions-log/2026-09-15_agent-notes-setup.md`参照。
