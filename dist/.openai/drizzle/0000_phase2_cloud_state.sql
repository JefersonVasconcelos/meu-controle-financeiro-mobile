CREATE TABLE IF NOT EXISTS finance_state (
  owner_email TEXT PRIMARY KEY NOT NULL,
  state_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
