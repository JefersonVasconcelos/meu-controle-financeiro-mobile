const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { webcrypto } = require("crypto");

function fakeElement() {
  const element = {
    value: "0", textContent: "", innerHTML: "", disabled: false, checked: false, dataset: {}, style: {}, options: [],
    elements: new Proxy({}, { get: () => fakeElement() }),
    classList: { add() {}, remove() {}, toggle() {}, contains() { return true; } },
    addEventListener() {}, setAttribute() {}, removeAttribute() {}, querySelector() { return fakeElement(); }, querySelectorAll() { return []; },
    replaceChildren() {}, append() {}, focus() {}, reset() {}, reportValidity() { return true; }, closest() { return null; },
    getContext() { return null; }, getBoundingClientRect() { return { width: 320, height: 220 }; },
  };
  return new Proxy(element, { get(target, property) { if (!(property in target)) target[property] = fakeElement(); return target[property]; } });
}

const storage = new Map();
const document = { body: fakeElement(), activeElement: null, querySelector: () => fakeElement(), querySelectorAll: () => [], createElement: () => fakeElement(), addEventListener() {} };
const sandbox = {
  console, document, crypto: webcrypto, structuredClone, TextEncoder, URL, Intl, Date, FormData, Blob,
  localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) },
  navigator: { onLine: true }, location: { protocol: "file:" }, setTimeout, clearTimeout, confirm: () => true, prompt: () => "",
  btoa: (value) => Buffer.from(value, "binary").toString("base64"), atob: (value) => Buffer.from(value, "base64").toString("binary"),
  fetch: async () => ({ ok: false, json: async () => ({}) }),
};
sandbox.window = { ...sandbox, addEventListener() {}, requestAnimationFrame: (callback) => callback(), scrollTo() {}, devicePixelRatio: 1 };

const source = fs.readFileSync(path.join(__dirname, "..", "outputs", "controle-financeiro-mobile", "app.js"), "utf8");
const expose = `globalThis.phase4 = {
  setup(input, anchor = [2026, 6]) {
    state = { ...state, ...input, settings: { ...state.settings, ...(input.settings || {}) } };
    state.expenses = state.expenses.map((expense) => normalizeExpense(expense));
    selectedMonth = new Date(anchor[0], anchor[1], 1);
    return getStats();
  },
  forecast(stats) { return calculateSpendingForecast(stats); },
  cashflow(forecast, days, pace = 0, income = 0) { return forecastCashFlow(forecast, days, pace, income); },
  anomalies: detectAnomalies,
  subscriptions: detectSubscriptions,
  suggest: suggestExpenseCategory
};`;
vm.runInNewContext(`${source}\n${expose}`, sandbox, { filename: "app.js" });
const api = sandbox.phase4;

const expense = (id, date, amount, description = "Compra") => ({
  id, data_emissao: date, data_registro: date, descricao: description, fornecedor: description,
  categoria: "Outros", forma_pagamento: "Pix", valor_total: amount, valor_produtos: amount,
  status_pagamento: "Pago", origem: "Registro manual", confianca_leitura: 1, updated_at: `${date}T12:00:00.000Z`,
});

const history = [
  expense("jan", "2026-01-10", 1000), expense("feb", "2026-02-10", 1020), expense("mar", "2026-03-10", 980),
  expense("apr", "2026-04-10", 1010), expense("may", "2026-05-10", 990), expense("jun", "2026-06-10", 1005),
  expense("jul", "2026-07-10", 600),
];
const stats = api.setup({
  settings: { monthlyIncome: 3000, monthlyLimit: 2500, savingsGoal: 500, cycleStartDay: 1 },
  accounts: [{ id: "bank", name: "Banco", type: "Conta corrente", openingBalance: 2000, includeNetWorth: true, updated_at: "2026-01-01T00:00:00.000Z" }],
  incomes: [], transfers: [], cards: [], expenses: history, deletedExpenses: [], demoMode: false,
});
const forecast = api.forecast(stats);
assert.strictEqual(forecast.historyCount, 6);
assert.strictEqual(forecast.confidence, "Alta");
assert.ok(forecast.lower < forecast.forecast && forecast.upper > forecast.forecast);

const flow30 = api.cashflow(forecast, 30);
const flow90 = api.cashflow(forecast, 90);
assert.ok(flow90.income > flow30.income);
assert.ok(api.cashflow(forecast, 90, -20).projectedBalance > flow90.projectedBalance, "Reduzir o ritmo deve melhorar o saldo previsto");

api.setup({
  settings: { monthlyIncome: 3000 }, accounts: [], incomes: [], transfers: [], cards: [], deletedExpenses: [], demoMode: false,
  expenses: [
    expense("a", "2026-04-05", 49.9, "Streaming"), expense("b", "2026-05-05", 49.9, "Streaming"), expense("c", "2026-06-05", 49.9, "Streaming"),
    expense("d", "2026-07-01", 20, "Café"), expense("e", "2026-07-02", 21, "Café"), expense("f", "2026-07-03", 19, "Café"), expense("g", "2026-07-04", 900, "Equipamento"),
    expense("dup1", "2026-07-12", 80, "Mercado X"), expense("dup2", "2026-07-12", 80, "Mercado X"),
  ],
});
assert.ok(api.subscriptions().some((item) => item.name === "Streaming"));
assert.ok(api.anomalies().some((item) => item.type === "Possível duplicidade"));
assert.ok(api.anomalies().some((item) => item.type === "Valor fora do padrão"));
const suggestion = api.suggest(expense("s", "2026-07-01", 100, "Supermercado Central"));
assert.strictEqual(suggestion.category, "Mercado");
assert.ok(suggestion.confidence >= 0.8);

console.log("Phase 4 intelligence tests passed.");
