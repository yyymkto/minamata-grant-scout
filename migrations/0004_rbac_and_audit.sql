CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(user_id, role_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  request_id TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  ip TEXT,
  status INTEGER NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

INSERT INTO roles (name) VALUES ('admin') ON CONFLICT(name) DO NOTHING;
INSERT INTO roles (name) VALUES ('member') ON CONFLICT(name) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT users.id, roles.id
FROM users
JOIN roles ON roles.name = 'member'
LEFT JOIN user_roles
  ON user_roles.user_id = users.id
 AND user_roles.role_id = roles.id
WHERE user_roles.user_id IS NULL;
