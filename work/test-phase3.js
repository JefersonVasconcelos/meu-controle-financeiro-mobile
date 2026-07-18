const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { webcrypto } = require("crypto");

function fakeElement() {
  const element = {
    value: "", textContent: "", innerHTML: "", disabled: false, dataset: {}, style: {},
    elements: new Proxy({}, { get: () => fakeElement() }),
    classList: { add() {}, remove() {}, toggle() {}, contains() { return true; } },
    addEventListener() {}, setAttribute() {}, querySelector() { return fakeElement(); },
    querySelectorAll() { return []; }, replaceChildren() {}, append() {}, focus() {}, reset() {},
    getContext() { return null; }, getBoundingClientRect() { return { width: 320, height: 220 }; },
  };
  return new Proxy(element, { get(target, property) { if (!(property in target)) target[property] = fakeElement(); return target[property]; } });
}

const storage = new Map();
const document = {
  body: fakeElement(), activeElement: null,
  querySelector: () => fakeElement(), querySelectorAll: () => [], createElement: () => fakeElement(), addEventListener() {},
};
const sandbox = {
  console, document, crypto: webcrypto, structuredClone, TextEncoder, URL, Intl, Date, FormData, Blob,
  localStorage: {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  },
  navigator: {}, location: { protocol: "file:" }, setTimeout, clearTimeout, confirm: () => true,
  btoa: (value) => Buffer.from(value, "binary").toString("base64"),
  atob: (value) => Buffer.from(value, "base64").toString("binary"),
};
sandbox.window = { ...sandbox, addEventListener() {}, requestAnimationFrame: (callback) => callback(), scrollTo() {}, devicePixelRatio: 1 };

const source = fs.readFileSync(path.join(__dirname, "..", "outputs", "controle-financeiro-mobile", "app.js"), "utf8");
const expose = `globalThis.phase3 = {
  health(settings, expenses = []) {
    state.settings = { ...state.settings, ...settings };
    state.expenses = expenses.map((expense) => normalizeExpense(expense));
    selectedMonth = new Date(2026, 6, 1);
    const stats = getStats();
    return { stats, health: calculateFinancialHealth(stats) };
  },
  normalizeFinancialState
};`;
vm.runInNewContext(`${source}\n${expose}`, sandbox, { filename: "app.js" });

const expense = (id, value, status = "Pago") => ({
  id, data_emissao: "2026-07-18", data_registro: "2026-07-18", descricao: id,
  categoria: "Mercado", forma_pagamento: "Pix", valor_total: value,
  status_pagamento: status, origem: "Registro manual",
});

const result = sandbox.phase3.health({
  monthlyLimit: 3000, savingsGoal: 600, monthlyIncome: 4000,
  emergencyReserveCurrent: 6000, emergencyReserveGoal: 12000, cycleStartDay: 1,
}, [expense("compra", 500)]);
assert.strictEqual(result.health.income, 4000);
assert.strictEqual(result.health.reserveProgress, 0.5);
assert.ok(result.health.score >= 0 && result.health.score <= 100, "A pontuação deve permanecer entre 0 e 100");

const normalized = sandbox.phase3.normalizeFinancialState({
  settings: { monthlyIncome: -1, emergencyReserveCurrent: 2500, emergencyReserveGoal: 10000 },
  expenses: [], deletedExpenses: [], demoMode: false,
});
assert.strictEqual(normalized.settings.monthlyIncome, 0, "Renda negativa não pode ser aceita");
assert.strictEqual(normalized.settings.emergencyReserveCurrent, 2500);
assert.strictEqual(normalized.settings.emergencyReserveGoal, 10000);

const html = fs.readFileSync(path.join(__dirname, "..", "outputs", "controle-financeiro-mobile", "index.html"), "utf8");
for (const requiredId of ["planningView", "healthScore", "planningMetrics", "projectionSummary", "reserveBar", "categoryPlanning", "planningActions"]) {
  assert.ok(html.includes(`id="${requiredId}"`), `Elemento da Fase 3 ausente: ${requiredId}`);
}

console.log("Phase 3 tests passed.");
