CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS memberships (
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(organization_id, user_id)
);

ALTER TABLE sessions ADD COLUMN current_org_id INTEGER REFERENCES organizations(id);
ALTER TABLE audit_logs ADD COLUMN organization_id INTEGER REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org_id ON memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_sessions_current_org_id ON sessions(current_org_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id);

INSERT INTO organizations (name, slug)
SELECT users.name || '''s Workspace', 'workspace-' || users.id
FROM users
WHERE NOT EXISTS (
  SELECT 1
  FROM organizations
  WHERE organizations.slug = 'workspace-' || users.id
);

INSERT INTO memberships (organization_id, user_id, role)
SELECT organizations.id, users.id, 'owner'
FROM users
JOIN organizations ON organizations.slug = 'workspace-' || users.id
LEFT JOIN memberships
  ON memberships.organization_id = organizations.id
 AND memberships.user_id = users.id
WHERE memberships.user_id IS NULL;

UPDATE sessions
SET current_org_id = (
  SELECT memberships.organization_id
  FROM memberships
  WHERE memberships.user_id = sessions.user_id
  ORDER BY memberships.organization_id
  LIMIT 1
)
WHERE current_org_id IS NULL;
