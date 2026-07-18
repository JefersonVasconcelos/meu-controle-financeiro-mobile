CREATE TABLE IF NOT EXISTS finance_state_history (
  owner_email TEXT NOT NULL,
  revision INTEGER NOT NULL,
  state_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (owner_email, revision)
);

CREATE INDEX IF NOT EXISTS finance_state_history_owner_created_idx
  ON finance_state_history (owner_email, created_at DESC);

CREATE TABLE IF NOT EXISTS finance_audit_event (
  id TEXT PRIMARY KEY NOT NULL,
  owner_email TEXT NOT NULL,
  event_type TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS finance_audit_owner_created_idx
  ON finance_audit_event (owner_email, created_at DESC);
