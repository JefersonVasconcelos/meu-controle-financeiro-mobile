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
globalThis.phase1 = {
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
  getCycleBoundsFor(anchor, settings) {
    state.settings = { ...state.settings, ...settings };
    selectedMonth = new Date(anchor[0], anchor[1], 1);
    const bounds = getCycleBounds();
    return { start: localDateKey(bounds.start), end: localDateKey(bounds.end) };
  }
};`;
vm.runInNewContext(`${source}\n${expose}`, sandbox, { filename: "app.js" });

const api = sandbox.phase1;
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
for (const requiredId of ["demoBanner", "clearDemoData", "lockApp", "savingsValue", "editExpense", "toastRegion"]) {
  assert.ok(html.includes(`id="${requiredId}"`), `Elemento obrigatório ausente: ${requiredId}`);
}

(async () => {
  const credential = await api.createPinCredential("1234");
  assert.ok(credential.startsWith("pbkdf2$120000$"), "O PIN deve usar PBKDF2 com salt");
  assert.strictEqual(await api.verifyPin("1234", credential), true);
  assert.strictEqual(await api.verifyPin("9999", credential), false);
  console.log("Phase 1 tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
