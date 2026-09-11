-- ハイブリッド配点モデル（LLM分類 + 決定論的スコア計算）への移行に伴うカラム追加
-- industries / themes / uniqueness_tags はカンマ区切りのキー一覧
-- score_breakdown は内訳（industry_fit, theme_fit, core, uniqueness_bonus, time_limited_modifier 等）のJSON
ALTER TABLE grant_ai_analyses ADD COLUMN industries TEXT;
ALTER TABLE grant_ai_analyses ADD COLUMN themes TEXT;
ALTER TABLE grant_ai_analyses ADD COLUMN uniqueness_tags TEXT;
ALTER TABLE grant_ai_analyses ADD COLUMN score_breakdown TEXT;
