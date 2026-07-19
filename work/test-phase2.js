const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { webcrypto } = require("crypto");

function fakeElement() {
  const element = {
    value: "",
    textContent: "",
    disabled: false,
    dataset: {},
    style: {},
    elements: new Proxy({}, { get: () => fakeElement() }),
    classList: { add() {}, remove() {}, toggle() {}, contains() { return true; } },
    addEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    querySelector() { return fakeElement(); },
    querySelectorAll() { return []; },
    replaceChildren() {},
    append() {},
    focus() {},
    reset() {},
    getContext() { return null; },
    getBoundingClientRect() { return { width: 320, height: 220 }; },
  };
  return new Proxy(element, {
    get(target, property) {
      if (!(property in target)) target[property] = fakeElement();
      return target[property];
    },
  });
}

const storage = new Map();
const document = {
  body: fakeElement(),
  activeElement: null,
  querySelector: () => fakeElement(),
  querySelectorAll: () => [],
  getElementById: () => fakeElement(),
  createElement: () => fakeElement(),
  addEventListener() {},
};
const localStorage = {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};
const sandbox = {
  console,
  document,
  localStorage,
  navigator: {},
  location: { protocol: "file:" },
  crypto: webcrypto,
  structuredClone,
  TextEncoder,
  URL,
  Intl,
  Date,
  FormData,
  Blob,
  setTimeout,
  clearTimeout,
  confirm: () => true,
  btoa: (value) => Buffer.from(value, "binary").toString("base64"),
  atob: (value) => Buffer.from(value, "base64").toString("binary"),
};
sandbox.window = {
  ...sandbox,
  addEventListener() {},
  setTimeout,
  clearTimeout,
  requestAnimationFrame: (callback) => callback(),
  scrollTo() {},
  devicePixelRatio: 1,
};

const appPath = path.join(__dirname, "..", "outputs", "controle-financeiro-mobile", "app.js");
const source = fs.readFileSync(appPath, "utf8");
const expose = `
globalThis.phase2 = {
  calculate(anchor, settings, expenses) {
    state.settings = { ...state.settings, ...settings };
    state.expenses = expenses.map((expense) => normalizeExpense(expense));
    selectedMonth = new Date(anchor[0], anchor[1], 1);
    return getStats();
  },
  normalizeExpense,
  isValidWebhookUrl,
  createPinCredential,
  verifyPin,
  normalizeFinancialState,
  mergeFinancialStates,
  createEmptyState,
  stripDemoFinancialState,
  getCycleBoundsFor(anchor, settings) {
    state.settings = { ...state.settings, ...settings };
    selectedMonth = new Date(anchor[0], anchor[1], 1);
    const bounds = getCycleBounds();
    return { start: localDateKey(bounds.start), end: localDateKey(bounds.end) };
  }
};`;
vm.runInNewContext(`${source}\n${expose}`, sandbox, { filename: "app.js" });

const api = sandbox.phase2;
const expense = (id, date, value) => ({
  id,
  data_emissao: date,
  data_registro: date,
  descricao: id,
  categoria: "Mercado",
  forma_pagamento: "Pix",
  valor_total: value,
  status_pagamento: "Pago",
  origem: "Registro manual",
});

const bounds = api.getCycleBoundsFor([2026, 6], { cycleStartDay: 18 });
assert.strictEqual(bounds.start, "2026-07-18", "O ciclo deve começar no dia configurado");
assert.strictEqual(bounds.end, "2026-08-17", "O ciclo deve atravessar corretamente dois meses");

const stats = api.calculate([2026, 6], { monthlyLimit: 2200, savingsGoal: 300, cycleStartDay: 18 }, [
  expense("before", "2026-07-17", 10),
  expense("start", "2026-07-18", 100),
  expense("end", "2026-08-17", 200),
  expense("after", "2026-08-18", 20),
]);
assert.strictEqual(stats.total, 300, "Só gastos dentro do ciclo devem entrar no total");
assert.strictEqual(stats.spendingBudget, 1900, "A meta de economia deve reduzir o orçamento para gastar");
assert.strictEqual(stats.available, 1600, "O orçamento restante deve descontar os gastos do orçamento para gastar");

const past = api.calculate([2020, 0], { cycleStartDay: 1 }, []);
assert.strictEqual(past.position, "past");
assert.strictEqual(past.projected, 0, "Ciclo passado sem gasto não deve criar projeção");
const future = api.calculate([2099, 0], { cycleStartDay: 1 }, []);
assert.strictEqual(future.position, "future");
assert.strictEqual(future.dailyAverage, 0, "Ciclo futuro não deve usar os dias do mês atual");

const normalized = api.normalizeExpense({
  id: '" onclick="alert(1)',
  descricao: "Teste",
  categoria: "Categoria inventada",
  forma_pagamento: "Meio inventado",
  valor_total: "R$ 12,34",
  status_pagamento: "qualquer",
});
assert.match(normalized.id, /^[a-zA-Z0-9_-]{1,80}$/);
assert.strictEqual(normalized.categoria, "Outros");
assert.strictEqual(normalized.forma_pagamento, "Pix");
assert.strictEqual(normalized.status_pagamento, "Pendente");
assert.strictEqual(normalized.valor_total, 12.34);

assert.strictEqual(api.isValidWebhookUrl("https://example.com/webhook"), true);
assert.strictEqual(api.isValidWebhookUrl("http://example.com/webhook"), false);
assert.strictEqual(api.isValidWebhookUrl("javascript:alert(1)"), false);

const html = fs.readFileSync(path.join(__dirname, "..", "outputs", "controle-financeiro-mobile", "index.html"), "utf8");
for (const requiredId of ["demoBanner", "clearDemoData", "removeDemoData", "lockApp", "savingsValue", "editExpense", "toastRegion"]) {
  assert.ok(html.includes(`id="${requiredId}"`), `Elemento obrigatório ausente: ${requiredId}`);
}

for (const requiredId of ["cloudStatus", "syncNowTop", "syncNow", "cloudAccount", "exportBackup", "importBackup"]) {
  assert.ok(html.includes(`id="${requiredId}"`), `Elemento da Fase 2 ausente: ${requiredId}`);
}

const oldExpense = { ...expense("shared", "2026-07-18", 10), updated_at: "2026-07-18T10:00:00.000Z" };
const newExpense = { ...expense("shared", "2026-07-18", 25), updated_at: "2026-07-18T11:00:00.000Z" };
const merged = api.mergeFinancialStates(
  { settings: { monthlyLimit: 1000 }, expenses: [oldExpense], deletedExpenses: [], demoMode: false },
  { settings: { monthlyLimit: 2000 }, expenses: [newExpense], deletedExpenses: [], demoMode: false },
  true,
);
assert.strictEqual(merged.expenses.length, 1, "A mesclagem não deve duplicar o mesmo gasto");
assert.strictEqual(merged.expenses[0].valor_total, 25, "A versão mais recente do gasto deve vencer");
assert.strictEqual(merged.settings.monthlyLimit, 2000, "A configuração escolhida deve vencer na mesclagem");

const deleted = api.mergeFinancialStates(
  merged,
  { settings: merged.settings, expenses: [], deletedExpenses: [{ id: "shared", deleted_at: "2026-07-18T12:00:00.000Z" }], demoMode: false },
  true,
);
assert.strictEqual(deleted.expenses.length, 0, "Uma exclusão mais recente não pode reaparecer após a mesclagem");
assert.strictEqual(deleted.deletedExpenses.length, 1, "A exclusão deve permanecer registrada para outros dispositivos");

const normalizedCloud = api.normalizeFinancialState({
  settings: { monthlyLimit: 1200, webhookUrl: "https://segredo.example/webhook" },
  expenses: [],
  deletedExpenses: [],
  demoMode: false,
});
assert.strictEqual(Object.hasOwn(normalizedCloud.settings, "webhookUrl"), false, "O webhook local não deve ir para a nuvem");

const emptyState = api.createEmptyState("https://example.com/webhook");
assert.strictEqual(emptyState.demoMode, false, "Após a exclusão o modo de demonstração não pode reaparecer");
assert.strictEqual(emptyState.expenses.length, 0, "Após a exclusão não pode haver gastos de exemplo");
assert.strictEqual(emptyState.accounts.length, 0, "Após a exclusão não pode haver contas de exemplo");
assert.strictEqual(emptyState.incomes.length, 0, "Após a exclusão não pode haver receitas de exemplo");
assert.strictEqual(emptyState.cards.length, 0, "Após a exclusão não pode haver cartões de exemplo");
assert.strictEqual(emptyState.settings.monthlyLimit, 0, "Após a exclusão o orçamento deve voltar a zero");
assert.strictEqual(emptyState.settings.webhookUrl, "https://example.com/webhook", "A configuração local do webhook pode ser preservada");

const cleanedMixedState = api.stripDemoFinancialState({
  settings: {
    monthlyLimit: 2200,
    cycleStartDay: 1,
    savingsGoal: 300,
    monthlyIncome: 3500,
    emergencyReserveCurrent: 1500,
    emergencyReserveGoal: 9000,
    categoryLimits: { Mercado: 650, Outros: 125 },
  },
  accounts: [
    { id: "sample-account-bank", name: "Conta principal", openingBalance: 2200 },
    { id: "real-account", name: "Minha conta", openingBalance: 25 },
  ],
  incomes: [{ id: "sample-income-1", description: "Renda mensal", amount: 3500, date: "2026-07-05", accountId: "sample-account-bank" }],
  cards: [{ id: "sample-card-1", name: "Cartão principal", accountId: "sample-account-bank", limit: 2500 }],
  expenses: [
    expense("sample-1", "2026-07-02", 274.7),
    expense("real-1", "2026-07-10", 120),
    expense("real-2", "2026-07-12", 222.65),
  ],
  deletedExpenses: [],
  demoMode: false,
});
assert.deepStrictEqual(Array.from(cleanedMixedState.expenses, (item) => item.id), ["real-1", "real-2"], "A limpeza seletiva deve preservar os dois lançamentos reais");
assert.deepStrictEqual(Array.from(cleanedMixedState.accounts, (item) => item.id), ["real-account"], "A limpeza seletiva deve remover somente contas de exemplo");
assert.strictEqual(cleanedMixedState.incomes.length, 0, "A receita de exemplo deve ser removida");
assert.strictEqual(cleanedMixedState.cards.length, 0, "O cartão de exemplo deve ser removido");
assert.strictEqual(cleanedMixedState.settings.monthlyIncome, 0, "A renda mensal fictícia deve ser zerada");
assert.strictEqual(cleanedMixedState.settings.emergencyReserveCurrent, 0, "A reserva fictícia deve ser zerada");
assert.strictEqual(cleanedMixedState.settings.categoryLimits.Mercado, undefined, "Limites de categoria fictícios devem ser removidos");
assert.strictEqual(cleanedMixedState.settings.categoryLimits.Outros, 125, "Limites personalizados devem ser preservados");
assert.strictEqual(cleanedMixedState.demoMode, false);

const legitimateIncome = api.stripDemoFinancialState({
  settings: { monthlyIncome: 3500, cycleStartDay: 1 },
  expenses: [expense("real-only", "2026-07-10", 20)],
  demoMode: false,
});
assert.strictEqual(legitimateIncome.settings.monthlyIncome, 3500, "Um valor legítimo isolado não pode ser tratado como demonstração");

assert.ok(html.includes('id="clearDemoData" type="button">Remover dados de exemplo</button>'), "O botão do aviso deve remover somente exemplos");
assert.ok(html.includes('id="removeDemoData" class="secondary-button" type="button">Remover dados de exemplo</button>'), "A limpeza seletiva deve ficar disponível no perfil");
assert.ok(html.includes('id="eraseCloudData" class="danger-button" type="button">Excluir todos os dados</button>'), "O botão para excluir todos os dados deve ser explícito");

class MockStatement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async run() {
    if (this.sql.startsWith("CREATE TABLE")) return { success: true };
    if (this.sql.startsWith("INSERT INTO")) {
      const [email, stateJson, updatedAt] = this.values;
      if (this.db.rows.has(email)) throw new Error("duplicate");
      this.db.rows.set(email, { state_json: stateJson, revision: 1, updated_at: updatedAt });
      return { success: true };
    }
    throw new Error(`Unexpected run SQL: ${this.sql}`);
  }
  async first() {
    if (this.sql.startsWith("SELECT")) {
      const row = this.db.rows.get(this.values[0]);
      return row ? { ...row } : null;
    }
    if (this.sql.startsWith("UPDATE")) {
      const [stateJson, updatedAt, email, expectedRevision] = this.values;
      const row = this.db.rows.get(email);
      if (!row || row.revision !== expectedRevision) return null;
      const next = { state_json: stateJson, revision: row.revision + 1, updated_at: updatedAt };
      this.db.rows.set(email, next);
      return { revision: next.revision, updated_at: next.updated_at };
    }
    throw new Error(`Unexpected first SQL: ${this.sql}`);
  }
}

class MockD1 {
  constructor() { this.rows = new Map(); }
  prepare(sql) { return new MockStatement(this, sql); }
}

(async () => {
  const credential = await api.createPinCredential("1234");
  assert.ok(credential.startsWith("pbkdf2$120000$"), "O PIN deve usar PBKDF2 com salt");
  assert.strictEqual(await api.verifyPin("1234", credential), true);
  assert.strictEqual(await api.verifyPin("9999", credential), false);

  const workerSource = fs.readFileSync(path.join(__dirname, "..", "dist", "server", "index.js"), "utf8");
  const workerUrl = `data:text/javascript;base64,${Buffer.from(workerSource).toString("base64")}`;
  const worker = (await import(workerUrl)).default;
  const env = { DB: new MockD1() };
  const call = (method, email, body, pathname = "/api/state") => worker.fetch(new Request(`https://app.test${pathname}`, {
    method,
    headers: email ? { "oai-authenticated-user-email": email, ...(body ? { "content-type": "application/json" } : {}) } : {},
    body: body ? JSON.stringify(body) : undefined,
  }), env);

  let response = await call("GET", "", null);
  assert.strictEqual(response.status, 401, "A API deve recusar chamadas sem usuário autenticado");
  response = await call("GET", "pessoa@example.com", null);
  let payload = await response.json();
  assert.strictEqual(payload.state, null);
  assert.strictEqual(payload.revision, 0);

  const cloudState = {
    settings: { monthlyLimit: 2200, cycleStartDay: 1, savingsGoal: 300, categoryLimits: {} },
    expenses: [{ ...expense("cloud-1", "2026-07-18", 55), categoria: "Categoria inválida", updated_at: "2026-07-18T10:00:00.000Z" }],
    deletedExpenses: [],
    demoMode: false,
  };
  response = await call("PUT", "pessoa@example.com", { state: cloudState, expectedRevision: 0 });
  payload = await response.json();
  assert.strictEqual(response.status, 200);
  assert.strictEqual(payload.revision, 1);
  assert.strictEqual(payload.state.expenses[0].categoria, "Outros", "O servidor deve validar campos recebidos");

  response = await call("PUT", "pessoa@example.com", { state: cloudState, expectedRevision: 0 });
  payload = await response.json();
  assert.strictEqual(response.status, 409, "Uma revisão antiga deve gerar conflito");
  assert.strictEqual(payload.revision, 1);

  response = await call("PUT", "pessoa@example.com", { state: cloudState, expectedRevision: 1 });
  payload = await response.json();
  assert.strictEqual(payload.revision, 2, "A atualização correta deve avançar a revisão");

  response = await call("GET", "outra@example.com", null);
  payload = await response.json();
  assert.strictEqual(payload.state, null, "Contas diferentes não podem compartilhar dados");

  const demoState = {
    settings: {
      monthlyLimit: 2200,
      cycleStartDay: 1,
      savingsGoal: 300,
      monthlyIncome: 3500,
      emergencyReserveCurrent: 1500,
      emergencyReserveGoal: 9000,
      categoryLimits: { Mercado: 650, Moradia: 900 },
    },
    accounts: [
      { id: "sample-account-bank", name: "Conta principal", type: "Conta corrente", openingBalance: 2200 },
      { id: "sample-account-wallet", name: "Carteira", type: "Carteira", openingBalance: 180 },
    ],
    incomes: [{ id: "sample-income-1", description: "Renda mensal", amount: 3500, date: "2026-07-05", accountId: "sample-account-bank" }],
    cards: [{ id: "sample-card-1", name: "Cartão principal", accountId: "sample-account-bank", limit: 2500, closingDay: 20, dueDay: 28 }],
    expenses: [expense("real-1", "2026-07-10", 120), expense("real-2", "2026-07-12", 222.65)],
    deletedExpenses: [],
    demoMode: false,
  };
  response = await call("PUT", "demo@example.com", { state: demoState, expectedRevision: 0 });
  assert.strictEqual(response.status, 200);
  response = await call("POST", "demo@example.com", { confirm: "REMOVER_EXEMPLOS" }, "/api/account-data/remove-demo");
  payload = await response.json();
  assert.strictEqual(response.status, 200, "A limpeza seletiva deve ser processada pelo servidor");
  assert.strictEqual(payload.changed, true);
  assert.strictEqual(payload.state.accounts.length, 0, "As contas de exemplo devem ser removidas no servidor");
  assert.strictEqual(payload.state.incomes.length, 0, "A renda de exemplo deve ser removida no servidor");
  assert.strictEqual(payload.state.settings.monthlyIncome, 0, "A renda mensal fictícia deve ser zerada no servidor");
  assert.strictEqual(payload.state.settings.categoryLimits.Moradia, 900, "Uma configuração personalizada deve ser preservada");
  assert.deepStrictEqual(Array.from(payload.state.expenses, (item) => item.id), ["real-1", "real-2"], "Os dois lançamentos reais devem ser preservados");
  assert.strictEqual(payload.summary.preservedExpenses, 2);

  console.log("Phase 2 tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
