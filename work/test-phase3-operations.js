const assert = require("assert");
const fs = require("fs");
const path = require("path");

class Statement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async run() {
    const sql = this.sql;
    if (sql.startsWith("CREATE TABLE")) return { success: true };
    if (sql.startsWith("INSERT INTO finance_state ")) {
      const [email, stateJson, updatedAt] = this.values;
      if (this.db.state.has(email)) throw new Error("duplicate");
      this.db.state.set(email, { state_json: stateJson, revision: 1, updated_at: updatedAt });
      return { success: true };
    }
    if (sql.startsWith("INSERT OR IGNORE INTO finance_state_history")) {
      const [email, revision, stateJson, createdAt] = this.values;
      if (!this.db.history.has(email)) this.db.history.set(email, new Map());
      if (!this.db.history.get(email).has(revision)) this.db.history.get(email).set(revision, { revision, state_json: stateJson, created_at: createdAt });
      return { success: true };
    }
    if (sql.startsWith("INSERT INTO finance_audit_event")) {
      const [id, email, type, metadata, createdAt] = this.values;
      this.db.audit.push({ id, owner_email: email, event_type: type, metadata_json: metadata, created_at: createdAt });
      return { success: true };
    }
    if (sql.startsWith("DELETE FROM finance_state_history WHERE owner_email = ? AND revision NOT IN")) return { success: true };
    if (sql === "DELETE FROM finance_state WHERE owner_email = ?") { this.db.state.delete(this.values[0]); return { success: true }; }
    if (sql === "DELETE FROM finance_state_history WHERE owner_email = ?") { this.db.history.delete(this.values[0]); return { success: true }; }
    if (sql === "DELETE FROM finance_audit_event WHERE owner_email = ?") { this.db.audit = this.db.audit.filter((item) => item.owner_email !== this.values[0]); return { success: true }; }
    throw new Error(`Unexpected run: ${sql}`);
  }
  async first() {
    const sql = this.sql;
    if (sql.startsWith("SELECT state_json, revision, updated_at FROM finance_state")) {
      const row = this.db.state.get(this.values[0]);
      return row ? { ...row } : null;
    }
    if (sql.startsWith("SELECT state_json, revision, created_at FROM finance_state_history")) {
      return this.db.history.get(this.values[0])?.get(this.values[1]) || null;
    }
    if (sql.startsWith("UPDATE finance_state SET")) {
      const [stateJson, updatedAt, email, expectedRevision] = this.values;
      const row = this.db.state.get(email);
      if (!row || row.revision !== expectedRevision) return null;
      const updated = { state_json: stateJson, revision: row.revision + 1, updated_at: updatedAt };
      this.db.state.set(email, updated);
      return { revision: updated.revision, updated_at: updatedAt };
    }
    throw new Error(`Unexpected first: ${sql}`);
  }
  async all() {
    if (this.sql.startsWith("SELECT revision, created_at FROM finance_state_history")) {
      const rows = [...(this.db.history.get(this.values[0])?.values() || [])].sort((a, b) => b.revision - a.revision);
      return { results: rows.map(({ revision, created_at }) => ({ revision, created_at })) };
    }
    if (this.sql.startsWith("SELECT id, event_type")) {
      return { results: this.db.audit.filter((item) => item.owner_email === this.values[0]).sort((a, b) => b.created_at.localeCompare(a.created_at)) };
    }
    throw new Error(`Unexpected all: ${this.sql}`);
  }
}

class MockD1 {
  constructor() { this.state = new Map(); this.history = new Map(); this.audit = []; }
  prepare(sql) { return new Statement(this, sql); }
}

(async () => {
  const workerSource = fs.readFileSync(path.join(__dirname, "..", "dist", "server", "index.js"), "utf8");
  const worker = (await import(`data:text/javascript;base64,${Buffer.from(workerSource).toString("base64")}`)).default;
  const env = { DB: new MockD1() };
  const email = "pessoa@example.com";
  const call = (pathName, method = "GET", body) => worker.fetch(new Request(`https://app.test${pathName}`, {
    method, headers: { "oai-authenticated-user-email": email, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }), env);
  const state1 = { settings: {}, accounts: [], incomes: [], transfers: [], cards: [], expenses: [], deletedExpenses: [], demoMode: false };
  const state2 = { ...state1, settings: { monthlyLimit: 2000 } };

  let response = await call("/api/state", "PUT", { state: state1, expectedRevision: 0 });
  assert.strictEqual(response.status, 200);
  response = await call("/api/state", "PUT", { state: state2, expectedRevision: 1 });
  let payload = await response.json();
  assert.strictEqual(payload.revision, 2);

  response = await call("/api/history");
  payload = await response.json();
  assert.deepStrictEqual(payload.items.map((item) => item.revision), [1]);

  response = await call("/api/audit");
  payload = await response.json();
  assert.ok(payload.items.some((item) => item.eventType === "state_created"));
  assert.ok(payload.items.some((item) => item.eventType === "state_updated"));

  response = await call("/api/history/restore", "POST", { revision: 1, expectedRevision: 2 });
  payload = await response.json();
  assert.strictEqual(response.status, 200);
  assert.strictEqual(payload.revision, 3);
  assert.strictEqual(payload.state.settings.monthlyLimit, 0);

  response = await call("/api/health");
  payload = await response.json();
  assert.strictEqual(payload.status, "ok");

  response = await call("/api/account-data", "DELETE", { confirm: "EXCLUIR" });
  assert.strictEqual(response.status, 200);
  response = await call("/api/state");
  payload = await response.json();
  assert.strictEqual(payload.state, null);

  console.log("Phase 3 operations tests passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
