import { formatBRL, parseBRL, toCents } from "./money.js";
import {
  expenseFingerprint,
  isMissingDatabaseObject,
  mapLegacyAccount,
  mapLegacyExpense,
  normalizeText,
} from "./data-utils.js";

const SESSION_KEY = "mcf_session_v1";
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
  config: null,
  session: null,
  user: null,
  accounts: [],
  categories: [],
  expenses: [],
  settings: null,
  accountsAvailable: true,
  expenseAccountAvailable: true,
  loading: false,
};

class ApiError extends Error {
  constructor(message, status = 0, details = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    Object.assign(this, details);
  }
}

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function currentPeriod() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function monthLabel() {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date());
}

function dateLabel(value) {
  if (!value) return "Sem data";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR").format(new Date(year, month - 1, day));
}

function paymentLabel(value) {
  return ({ pix: "Pix", debito: "D√©bito", credito: "Cr√©dito", dinheiro: "Dinheiro", boleto: "Boleto", outro: "Outro" })[value] ?? "Outro";
}

function accountTypeLabel(value) {
  return ({
    conta_digital: "Conta digital",
    conta_corrente: "Conta corrente",
    poupanca: "Poupan√ßa",
    carteira: "Dinheiro / carteira",
    investimento: "Investimento",
    outro: "Outro",
  })[value] ?? value ?? "Conta";
}

function toast(message, type = "success") {
  const node = document.createElement("div");
  node.className = `toast ${type === "error" ? "error" : ""}`;
  node.textContent = message;
  $("#toast-region").append(node);
  setTimeout(() => node.remove(), 4200);
}

function showOnly(viewId) {
  ["#loading-view", "#fatal-view", "#auth-view", "#app-view"].forEach((id) => $(id).classList.toggle("hidden", id !== viewId));
}

function setButtonBusy(button, busy, label = "Aguarde‚Ä¶") {
  if (!button) return;
  if (busy) {
    button.dataset.originalLabel = button.textContent;
    button.textContent = label;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalLabel || button.textContent;
    button.disabled = false;
  }
}

function saveSession(session) {
  state.session = session;
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

function restoreSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (!session?.access_token || !session?.refresh_token) return null;
    return session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

async function readResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

async function rawRequest(path, { method = "GET", body, token, headers = {} } = {}) {
  const response = await fetch(`${state.config.supabaseUrl}${path}`, {
    method,
    headers: {
      apikey: state.config.supabasePublishableKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await readResponse(response);
  if (!response.ok) {
    const message = payload?.msg || payload?.message || payload?.error_description || payload?.error || `Erro ${response.status}`;
    throw new ApiError(message, response.status, typeof payload === "object" && payload ? payload : {});
  }
  return payload;
}

async function refreshSession() {
  if (!state.session?.refresh_token) throw new ApiError("Sua sess√£o expirou. Entre novamente.", 401);
  try {
    const next = await rawRequest("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: { refresh_token: state.session.refresh_token },
    });
    saveSession(next);
    return next;
  } catch (error) {
    saveSession(null);
    state.user = null;
    showOnly("#auth-view");
    throw error;
  }
}

async function apiRequest(path, options = {}, retry = true) {
  try {
    return await rawRequest(path, { ...options, token: state.session?.access_token });
  } catch (error) {
    if (retry && error.status === 401 && state.session?.refresh_token) {
      await refreshSession();
      return apiRequest(path, options, false);
    }
    throw error;
  }
}

async function signIn(email, password) {
  const session = await rawRequest("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
  saveSession(session);
  return session;
}

async function signUp(name, email, password) {
  return rawRequest("/auth/v1/signup", {
    method: "POST",
    body: { email, password, data: { display_name: name } },
  });
}

async function getUser() {
  return apiRequest("/auth/v1/user");
}

async function signOut() {
  try { await apiRequest("/auth/v1/logout", { method: "POST" }); } catch { /* local sign-out still applies */ }
  saveSession(null);
  state.user = null;
  showOnly("#auth-view");
}

function restPath(table, query = "") {
  return `/rest/v1/${table}${query ? `?${query}` : ""}`;
}

async function restSelect(table, query) {
  return apiRequest(restPath(table, query), { headers: { Accept: "application/json" } });
}

async function restInsert(table, body, { upsert = false, onConflict = "" } = {}) {
  const query = onConflict ? `on_conflict=${encodeURIComponent(onConflict)}` : "";
  return apiRequest(restPath(table, query), {
    method: "POST",
    body,
    headers: { Prefer: upsert ? "resolution=merge-duplicates,return=representation" : "return=representation" },
  });
}

async function loadAccounts() {
  try {
    const rows = await restSelect("accounts", "select=*&active=eq.true&order=created_at.asc");
    state.accountsAvailable = true;
    return rows || [];
  } catch (error) {
    if (isMissingDatabaseObject(error, "accounts")) {
      state.accountsAvailable = false;
      return [];
    }
    throw error;
  }
}

async function loadExpenses() {
  const base = "order=expense_date.desc,created_at.desc&limit=500";
  try {
    const rows = await restSelect("expenses", `select=id,description,amount,expense_date,payment_method,is_paid,notes,category_id,account_id,created_at&${base}`);
    state.expenseAccountAvailable = true;
    return rows || [];
  } catch (error) {
    if (!isMissingDatabaseObject(error, "account_id")) throw error;
    state.expenseAccountAvailable = false;
    const rows = await restSelect("expenses", `select=id,description,amount,expense_date,payment_method,is_paid,notes,category_id,created_at&${base}`);
    return (rows || []).map((row) => ({ ...row, account_id: null }));
  }
}

async function loadData({ announce = false } = {}) {
  if (state.loading) return;
  state.loading = true;
  $("#refresh-button").disabled = true;
  try {
    const { year, month } = currentPeriod();
    const [accounts, categories, expenses, settings] = await Promise.all([
      loadAccounts(),
      restSelect("categories", "select=*&order=sort_order.asc"),
      loadExpenses(),
      restSelect("monthly_settings", `select=*&year=eq.${year}&month=eq.${month}&limit=1`),
    ]);
    state.accounts = accounts;
    state.categories = categories || [];
    state.expenses = expenses;
    state.settings = settings?.[0] ?? null;
    renderAll();
    if (announce) toast("Dados atualizados.");
  } finally {
    state.loading = false;
    $("#refresh-button").disabled = false;
  }
}

function monthlyExpenses() {
  const { year, month } = currentPeriod();
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  return state.expenses.filter((expense) => String(expense.expense_date).startsWith(prefix));
}

function accountBalance(account) {
  const paid = state.expenses
    .filter((expense) => expense.is_paid && expense.account_id === account.id)
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  return Number(account.opening_balance || 0) - paid;
}

function setEmpty(container, message) {
  container.replaceChildren();
  const empty = document.createElement("p");
  empty.className = "empty";
  empty.textContent = message;
  container.append(empty);
}

function expenseListItem(expense, withDelete = false) {
  const category = state.categories.find((item) => item.id === expense.category_id);
  const account = state.accounts.find((item) => item.id === expense.account_id);
  const item = document.createElement("div");
  item.className = "list-item";

  const icon = document.createElement("span");
  icon.className = "list-icon";
  icon.textContent = (category?.name || expense.description || "G").slice(0, 1).toUpperCase();
  if (category?.color) {
    icon.style.color = category.color;
    icon.style.backgroundColor = `${category.color}18`;
  }

  const copy = document.createElement("div");
  copy.className = "list-copy";
  const title = document.createElement("strong");
  title.textContent = expense.description;
  const meta = document.createElement("span");
  meta.textContent = [dateLabel(expense.expense_date), category?.name, account?.name, paymentLabel(expense.payment_method)].filter(Boolean).join(" ¬∑ ");
  copy.append(title, meta);

  const value = document.createElement("strong");
  value.className = `list-value ${expense.is_paid ? "" : "pending"}`;
  value.textContent = formatBRL(expense.amount);

  item.append(icon, copy, value);
  if (withDelete) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-button";
    remove.title = "Excluir gasto";
    remove.setAttribute("aria-label", `Excluir ${expense.description}`);
    remove.textContent = "√ó";
    remove.addEventListener("click", () => deleteExpense(expense));
    item.append(remove);
  }
  return item;
}

function renderDashboard() {
  const expenses = monthlyExpenses();
  const expenseTotal = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const pending = expenses.filter((item) => !item.is_paid).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const balance = state.accounts.filter((item) => item.include_net_worth).reduce((sum, item) => sum + accountBalance(item), 0);
  const limit = Number(state.settings?.monthly_limit || 0);
  const percent = limit > 0 ? Math.round((expenseTotal / limit) * 100) : 0;

  $("#metric-balance").textContent = formatBRL(balance);
  $("#metric-expenses").textContent = formatBRL(expenseTotal);
  $("#metric-limit").textContent = formatBRL(limit);
  $("#metric-pending").textContent = formatBRL(pending);
  $("#limit-percent").textContent = `${percent}%`;
  $("#limit-caption").textContent = limit > 0 ? `${formatBRL(expenseTotal)} de ${formatBRL(limit)}` : "Defina seu limite mensal em Ajustes.";
  $("#limit-progress").style.width = `${Math.min(percent, 100)}%`;
  $("#limit-progress").cmvﬂé≠¢Gß≤⁄Óù∆≠y›-shadow); }
.metric-card span { font-size: .76rem; color: var(--muted); }
.metric-card strong { font-size: 1.08rem; overflow-wrap: anywhere; }
.metric-card.accent { background: linear-gradient(140deg, var(--brand), #15998f); color: #fff; border: 0; }
.metric-card.accent span { color: rgba(255,255,255,.76); }
.progress { height: .65rem; background: var(--brand-soft); border-radius: 99px; overflow: hidden; }
.progress-bar { height: 100%; width: 0; background: var(--brand); transition: width .2s; }
.progress-bar.over { background: var(--danger); }

.list { display: grid; gap: .2rem; }
.list-item { display: flex; align-items: center; gap: .7rem; padding: .72rem 0; border-bottom: 1px solid #edf2f1; }
.list-item:last-child { border-bottom: 0; }
.list-icon { flex: 0 0 2.35rem; height: 2.35rem; border-radius: .75rem; display: grid; place-items: center; background: var(--brand-soft); color: var(--brand); font-weight: 800; }
.list-copy { min-width: 0; flex: 1; }
.list-copy strong, .list-copy span { display: block; }
.list-copy strong { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: .9rem; }
.list-copy span { color: var(--muted); font-size: .75rem; margin-top: .15rem; }
.list-value { text-align: right; font-size: .88rem; white-space: nowrap; }
.list-value.pending { color: var(--warning); }
.delete-button { border: 0; background: transparent; color: var(--danger); padding: .45rem; font-size: 1rem; }
.empty { padding: 1rem .25rem; color: var(--muted); text-align: center; font-size: .85rem; }

.notice { border-radius: .9rem; padding: .85rem; margin-bottom: 1rem; display: grid; gap: .25rem; font-size: .83rem; }
.notice.warning { color: #6d3a06; background: #fff3d8; border: 1px solid #f6d48b; }
.bottom-nav { position: fixed; z-index: 10; left: 50%; bottom: 0; transform: translateX(-50%); width: min(100%, 680px); display: grid; grid-template-columns: repeat(4, 1fr); background: rgba(255,255,255,.96); backdrop-filter: blur(10px); border-top: 1px solid var(--line); padding: .5rem .45rem calc(.5rem + env(safe-area-inset-bottom)); }
.bottom-nav a { border: 0; background: transparent; color: var(--muted); display: grid; justify-items: center; gap: .18rem; padding: .35rem .2rem; font-size: .69rem; font-weight: 700; text-decoration: none; }
.bottom-nav a span { font-size: 1.25rem; line-height: 1; }
.bottom-nav a.active { color: var(--brand); }

.toast-region { position: fixed; z-index: 50; top: max(.8rem, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); width: min(calc(100% - 2rem), 480px); display: grid; gap: .5rem; pointer-events: none; }
.toast { background: #17332f; color: #fff; border-radius: .8rem; padding: .8rem 1rem; box-shadow: 0 12px 35px rgba(0,0,0,.2); font-size: .86rem; }
.toast.error { background: var(--danger); }

@media (max-width: 390px) {
  .form-grid { grid-template-columns: 1fr; }
  .metric-card strong { font-size: .96rem; }
}

@media (min-width: 681px) {
  .app-view { border-inline: 1px solid var(--line); background: var(--bg); }
}
