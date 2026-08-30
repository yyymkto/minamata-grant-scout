CREATE TABLE grants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  source_ministry TEXT NOT NULL,
  source_url TEXT NOT NULL UNIQUE,
  published_at TEXT,
  deadline TEXT,
  raw_text TEXT,
  category_raw TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_grants_source_ministry ON grants(source_ministry);
CREATE INDEX idx_grants_deadline ON grants(deadline);

CREATE TABLE grant_ai_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grant_id INTEGER NOT NULL UNIQUE REFERENCES grants(id) ON DELETE CASCADE,
  summary_short TEXT,
  support_type TEXT,
  target_entities TEXT,
  max_amount TEXT,
  subsidy_rate TEXT,
  eligible_themes TEXT,
  required_documents TEXT,
  notes TEXT,
  ai_confidence REAL,
  minamata_fit_rank TEXT,
  minamata_fit_score INTEGER,
  minamata_fit_reason TEXT,
  suggested_department TEXT,
  suggested_department_reason TEXT,
  minamata_use_case TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_grant_ai_analyses_grant_id ON grant_ai_analyses(grant_id);
CREATE INDEX idx_grant_ai_analyses_minamata_fit_rank ON grant_ai_analyses(minamata_fit_rank);
