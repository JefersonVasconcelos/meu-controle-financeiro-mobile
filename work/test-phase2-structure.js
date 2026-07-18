const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { webcrypto } = require("crypto");

function fakeElement() {
  const element = {
    value: "", textContent: "", innerHTML: "", disabled: false, checked: false, dataset: {}, style: {}, options: [],
    elements: new Proxy({}, { get: () => fakeElement() }),
    classList: { add() {}, remove() {}, toggle() {}, contains() { return true; } },
    addEventListener() {}, setAttribute() {}, removeAttribute() {}, querySelector() { return fakeElement(); }, querySelectorAll() { return []; },
    replaceChildren() {}, append() {}, focus() {}, reset() {}, reportValidity() { return true; },
    getContext() { return null; }, getBoundingClientRect() { return { width: 320, height: 220 }; }, closest() { return null; },
  };
  return new Proxy(element, { get(target, property) { if (!(property in target)) target[property] = fakeElement(); return target[property]; } });
}

const storage = new Map();
const document = {
  body: fakeElement(), activeElement: null, querySelector: () => fakeElement(), querySelectorAll: () => [],
  createElement: () => fakeElement(), addEventListener() {},
};
const sandbox = {
  console, document, crypto: webcrypto, structuredClone, TextEncoder, URL, Intl, Date, FormData, Blob,
  localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) },
  navigator: {}, location: { protocol: "file:" }, setTimeout, clearTimeout, confirm: () => true,
  btoa: (value) => Buffer.from(value, "binary").toString("base64"), atob: (value) => Buffer.from(value, "base64").toString("binary"),
};
sandbox.window = { ...sandbox, addEventListener() {}, requestAnimationFrame: (callback) => callback(), scrollTo() {}, devicePixelRatio: 1 };

const source = fs.readFileSync(path.join(__dirname, "..", "outputs", "controle-financeiro-mobile", "app.js"), "utf8");
const expose = `globalThis.phase2Structure = {
  normalize(input) { return normalizeFinancialState(input); },
  balance(input, accountId, date) { state = { ...state, ...normalizeFinancialState(input) }; return accountBalance(accountId, date); },
  addMonthsToDateKey, parseCsvStatement, parseOfxStatement, normalizeExpense
};`;
vm.runInNewContext(`${source}\n${expose}`, sandbox, { filename: "app.js" });
const api = sandbox.phase2Structure;

const base = {
  settings: {}, deletedExpenses: [], demoMode: false,
  accounts: [{ id: "bank", name: "Banco", type: "Conta corrente", openingBalance: 1000, includeNetWorth: true, updated_at: "2026-07-01T00:00:00.000Z" }],
  incomes: [{ id: "salary", description: "Salário", amount: 2000, date: "2026-07-05", accountId: "bank", updated_at: "2026-07-05T00:00:00.000Z" }],
  transfers: [], cards: [],
  expenses: [{ id: "expense", descricao: "Mercado", valor_total: 300, data_emissao: "2026-07-06", data_registro: "2026-07-06", categoria: "Mercado", forma_pagamento: "Pix", status_pagamento: "Pago", account_id: "bank", origem: "Registro manual", updated_at: "2026-07-06T00:00:00.000Z" }],
};
assert.strictEqual(api.balance(base, "bank", "2026-07-31"), 2700, "Saldo deve considerar saldo inicial, receita e despesa paga");

const withTransfer = structuredClone(base);
withTransfer.accounts.push({ id: "wallet", name: "Carteira", type: "Carteira", openingBalance: 100, includeNetWorth: true, updated_at: "2026-07-01T00:00:00.000Z" });
withTransfer.transfers.push({ id: "move", description: "Saque", amount: 200, date: "2026-07-10", fromAccountId: "bank", toAccountId: "wallet", updated_at: "2026-07-10T00:00:00.000Z" });
assert.strictEqual(api.balance(withTransfer, "bank", "2026-07-31"), 2500);
assert.strictEqual(api.balance(withTransfer, "wallet", "2026-07-31"), 300);
assert.strictEqual(api.balance(withTransfer, "bank", "2026-07-31") + api.balance(withTransfer, "wallet", "2026-07-31"), 2800, "Transferência não pode alterar o patrimônio total");

assert.strictEqual(api.addMonthsToDateKey("2026-01-31", 1), "2026-02-28", "Parcelas devem respeitar o último dia do mês");

const csv = "data;descricao;valor\n18/07/2026;Salário;3500,00\n19/07/2026;Mercado;-250,40";
const parsedCsv = api.parseCsvStatement(csv);
assert.strictEqual(parsedCsv.length, 2);
assert.strictEqual(parsedCsv[0].amount, 3500);
assert.strictEqual(parsedCsv[1].amount, -250.4);

const ofx = `<OFX><BANKTRANLIST><STMTTRN><DTPOSTED>20260718000000<TRNAMT>-89.90<NAME>Internet</STMTTRN></BANKTRANLIST></OFX>`;
const parsedOfx = api.parseOfxStatement(ofx);
assert.strictEqual(parsedOfx.length, 1);
assert.strictEqual(parsedOfx[0].date, "2026-07-18");
assert.strictEqual(parsedOfx[0].amount, -89.9);

const normalized = api.normalize({ ...base, accounts: [{ id: "bad id", name: "X", openingBalance: -50 }], incomes: [{ amount: -1 }], transfers: [{ amount: 10, fromAccountId: "same", toAccountId: "same" }] });
assert.match(normalized.accounts[0].id, /^[a-zA-Z0-9_-]+$/);
assert.strictEqual(normalized.accounts[0].openingBalance, -50);
assert.strictEqual(normalized.incomes.length, 0);
assert.strictEqual(normalized.transfers.length, 0);

console.log("Phase 2 financial structure tests passed.");
