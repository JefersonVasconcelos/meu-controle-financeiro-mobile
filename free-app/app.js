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
  recoveryMode: false,
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
  return ({ pix: "Pix", debito: "Débito", credito: "Crédito", dinheiro: "Dinheiro", boleto: "Boleto", outro: "Outro" })[value] ?? "Outro";
}

function accountTypeLabel(value) {
  return ({
    conta_digital: "Conta digital",
    conta_corrente: "Conta corrente",
    poupanca: "Poupança",
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

function setButtonBusy(button, busy, label = "Aguarde…") {
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

function consumeAuthCallback() {
  if (!window.location.hash) return { session: null, error: null, type: null };
  const params = new URLSearchParams(window.location.hash.slice(1));
  const isAuthCallback = params.has("access_token") || params.has("error") || params.has("error_description");
  if (!isAuthCallback) return { session: null, error: null, type: null };
  const type = params.get("type");

  const cleanUrl = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, document.title, cleanUrl);

  const error = params.get("error_description") || params.get("error");
  if (error) return { session: null, error, type };

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) {
    return { session: null, error: "O link não devolveu uma sessão válida. Solicite um novo link.", type };
  }

  const session = {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: params.get("token_type") || "bearer",
    expires_in: Number(params.get("expires_in") || 3600),
    expires_at: Number(params.get("expires_at") || 0) || undefined,
  };
  saveSession(session);
  return { session, error: null, type };
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
  if (!state.session?.refresh_token) throw new ApiError("Sua sessão expirou. Entre novamente.", 401);
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

async function requestPasswordReset() {
  const email = $("#login-email").value.trim();
  if (!email) {
    $("#login-email").focus();
    toast("Informe seu e-mail para recuperar a senha.", "error");
    return;
  }

  const button = $("#forgot-password");
  setButtonBusy(button, true, "Enviando…");
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  try {
    await rawRequest(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: "POST",
      body: { email },
    });
    toast("Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.");
  } catch (error) {
    toast(error.message || "Não foi possível enviar o link de recuperação.", "error");
  } finally {
    setButtonBusy(button, false);
  }
}

async function updatePassword(event) {
  event.preventDefault();
  const password = $("#new-password").value;
  const confirmation = $("#confirm-password").value;
  if (password.length < 6) return toast("A nova senha deve ter pelo menos 6 caracteres.", "error");
  if (password !== confirmation) return toast("As senhas não são iguais.", "error");

  const button = event.currentTarget.querySelector("button[type=submit]");
  setButtonBusy(button, true, "Salvando…");
  try {
    await apiRequest("/auth/v1/user", { method: "PUT", body: { password } });
    event.currentTarget.reset();
    state.recoveryMode = false;
    toast("Senha alterada com sucesso.");
  } catch (error) {
    toast(error.message || "Não foi possível alterar a senha.", "error");
  } finally {
    setButtonBusy(button, false);
  }
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
  meta.textContent = [dateLabel(expense.expense_date), category?.name, account?.name, paymentLabel(expense.payment_method)].filter(Boolean).join(" · ");
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
    remove.textContent = "×";
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
  $("#limit-progress").classList.toggle("over", percent > 100);

  const recent = $("#recent-expenses");
  if (!state.expenses.length) setEmpty(recent, "Nenhum gasto cadastrado ainda.");
  else recent.replaceChildren(...state.expenses.slice(0, 5).map((expense) => expenseListItem(expense)));
}

function renderAccounts() {
  const total = state.accounts.filter((item) => item.include_net_worth).reduce((sum, item) => sum + accountBalance(item), 0);
  $("#accounts-total").textContent = formatBRL(total);
  $("#account-form").querySelector("button[type=submit]").disabled = !state.accountsAvailable;

  const list = $("#accounts-list");
  if (!state.accountsAvailable) setEmpty(list, "Execute a migração do banco para cadastrar contas.");
  else if (!state.accounts.length) setEmpty(list, "Nenhuma conta cadastrada.");
  else {
    list.replaceChildren(...state.accounts.map((account) => {
      const item = document.createElement("div");
      item.className = "list-item";
      const icon = document.createElement("span");
      icon.className = "list-icon";
      icon.textContent = account.name.slice(0, 1).toUpperCase();
      const copy = document.createElement("div");
      copy.className = "list-copy";
      const title = document.createElement("strong");
      title.textContent = account.name;
      const meta = document.createElement("span");
      meta.textContent = accountTypeLabel(account.type);
      copy.append(title, meta);
      const value = document.createElement("strong");
      value.className = "list-value";
      value.textContent = formatBRL(accountBalance(account));
      item.append(icon, copy, value);
      return item;
    }));
  }
}

function renderSelects() {
  const category = $("#expense-category");
  category.replaceChildren(new Option("Sem categoria", ""), ...state.categories.map((item) => new Option(item.name, item.id)));
  const account = $("#expense-account");
  account.replaceChildren(new Option("Sem conta vinculada", ""), ...state.accounts.map((item) => new Option(item.name, item.id)));
  account.disabled = !state.expenseAccountAvailable;
}

function renderExpenses() {
  $("#expenses-count").textContent = String(state.expenses.length);
  const list = $("#expenses-list");
  if (!state.expenses.length) setEmpty(list, "Nenhum gasto cadastrado.");
  else list.replaceChildren(...state.expenses.map((expense) => expenseListItem(expense, true)));
}

function renderSettings() {
  $("#settings-month").textContent = `Referente a ${monthLabel()}.`;
  $("#monthly-limit").value = state.settings ? Number(state.settings.monthly_limit).toFixed(2).replace(".", ",") : "";
  $("#session-email").textContent = state.user?.email || "";
}

function renderAll() {
  $("#migration-warning").classList.toggle("hidden", state.accountsAvailable && state.expenseAccountAvailable);
  renderDashboard();
  renderAccounts();
  renderSelects();
  renderExpenses();
  renderSettings();
}

function openPanel(name) {
  $$(".panel").forEach((panel) => panel.classList.toggle("hidden", panel.id !== `panel-${name}`));
  $$(".bottom-nav [data-panel]").forEach((button) => button.classList.toggle("active", button.dataset.panel === name));
  const panel = $(`#panel-${name}`);
  $("#page-title").textContent = panel?.dataset.title || "Meu Controle Financeiro";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteExpense(expense) {
  if (!window.confirm(`Excluir o gasto “${expense.description}” de ${formatBRL(expense.amount)}?`)) return;
  try {
    await apiRequest(restPath("expenses", `id=eq.${encodeURIComponent(expense.id)}`), { method: "DELETE" });
    state.expenses = state.expenses.filter((item) => item.id !== expense.id);
    renderAll();
    toast("Gasto excluído.");
  } catch (error) {
    toast(error.message || "Não foi possível excluir.", "error");
  }
}

async function submitAccount(event) {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button[type=submit]");
  const amount = parseBRL($("#account-balance").value);
  const name = $("#account-name").value.trim();
  if (!name) return toast("Informe o nome da conta.", "error");
  if (!Number.isFinite(amount)) return toast("Informe um saldo inicial válido.", "error");
  setButtonBusy(button, true, "Salvando…");
  try {
    await restInsert("accounts", {
      user_id: state.user.id,
      name,
      type: $("#account-type").value,
      opening_balance: amount,
      include_net_worth: $("#account-net-worth").checked,
    });
    event.currentTarget.reset();
    $("#account-balance").value = "0,00";
    $("#account-net-worth").checked = true;
    await loadData();
    toast("Conta salva com sucesso.");
  } catch (error) {
    toast(error.message || "Não foi possível salvar a conta.", "error");
  } finally { setButtonBusy(button, false); }
}

async function submitExpense(event) {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button[type=submit]");
  const amount = parseBRL($("#expense-amount").value);
  const description = $("#expense-description").value.trim();
  if (!description) return toast("Descreva o gasto.", "error");
  if (!Number.isFinite(amount) || amount <= 0) return toast("Informe um valor maior que zero.", "error");

  const payload = {
    user_id: state.user.id,
    description,
    amount,
    expense_date: $("#expense-date").value,
    category_id: $("#expense-category").value || null,
    payment_method: $("#expense-payment").value,
    is_paid: $("#expense-paid").checked,
    notes: $("#expense-notes").value.trim() || null,
  };
  if (state.expenseAccountAvailable) payload.account_id = $("#expense-account").value || null;

  setButtonBusy(button, true, "Salvando…");
  try {
    await restInsert("expenses", payload);
    event.currentTarget.reset();
    $("#expense-date").value = todayISO();
    $("#expense-paid").checked = true;
    await loadData();
    toast("Gasto salvo com sucesso.");
  } catch (error) {
    toast(error.message || "Não foi possível salvar o gasto.", "error");
  } finally { setButtonBusy(button, false); }
}

async function submitLimit(event) {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button[type=submit]");
  const amount = parseBRL($("#monthly-limit").value);
  if (!Number.isFinite(amount) || amount < 0) return toast("Informe um limite válido.", "error");
  const { year, month } = currentPeriod();
  setButtonBusy(button, true, "Salvando…");
  try {
    await restInsert("monthly_settings", { user_id: state.user.id, year, month, monthly_limit: amount }, { upsert: true, onConflict: "user_id,year,month" });
    await loadData();
    toast("Limite mensal salvo.");
  } catch (error) {
    toast(error.message || "Não foi possível salvar o limite.", "error");
  } finally { setButtonBusy(button, false); }
}

async function importAccounts(rawAccounts) {
  const accountIds = new Map();
  if (!rawAccounts.length || !state.accountsAvailable) return { accountIds, imported: 0, skipped: rawAccounts.length };
  let imported = 0;
  let skipped = 0;
  for (const raw of rawAccounts) {
    const mapped = mapLegacyAccount(raw);
    if (!mapped) { skipped++; continue; }
    const existing = state.accounts.find((item) => normalizeText(item.name) === normalizeText(mapped.name));
    if (existing) {
      if (mapped.legacyId) accountIds.set(mapped.legacyId, existing.id);
      skipped++;
      continue;
    }
    const [created] = await restInsert("accounts", {
      user_id: state.user.id,
      name: mapped.name,
      type: mapped.type,
      opening_balance: mapped.opening_balance,
      include_net_worth: Boolean(mapped.include_net_worth),
    });
    if (created && mapped.legacyId) accountIds.set(mapped.legacyId, created.id);
    if (created) state.accounts.push(created);
    imported++;
  }
  return { accountIds, imported, skipped };
}

async function importCategoryLimits(settings, categoriesByName) {
  const values = settings?.categoryLimits;
  if (!values || typeof values !== "object" || Array.isArray(values)) return 0;
  const { year, month } = currentPeriod();
  const rows = Object.entries(values).flatMap(([name, rawAmount]) => {
    const amount = parseBRL(rawAmount);
    const categoryId = categoriesByName.get(normalizeText(name));
    return Number.isFinite(amount) && amount >= 0 && categoryId
      ? [{ user_id: state.user.id, category_id: categoryId, year, month, amount }]
      : [];
  });
  if (!rows.length) return 0;
  try {
    await restInsert("category_limits", rows, { upsert: true, onConflict: "user_id,category_id,year,month" });
    return rows.length;
  } catch (error) {
    if (isMissingDatabaseObject(error, "category_limits")) return 0;
    throw error;
  }
}

async function importBackup() {
  const file = $("#backup-file").files?.[0];
  if (!file) return toast("Selecione o arquivo JSON do backup.", "error");
  if (file.size > 5 * 1024 * 1024) return toast("O backup excede o limite de 5 MB.", "error");
  const button = $("#import-button");
  setButtonBusy(button, true, "Importando…");
  $("#import-report").textContent = "";
  try {
    const backup = JSON.parse(await file.text());
    const legacy = backup?.state;
    if (!legacy || !Array.isArray(legacy.expenses)) throw new Error("Este arquivo não tem o formato de backup esperado.");

    const categoriesByName = new Map(state.categories.map((item) => [normalizeText(item.name), item.id]));
    const accountResult = await importAccounts(Array.isArray(legacy.accounts) ? legacy.accounts : []);
    const existing = new Set(state.expenses.map(expenseFingerprint));
    const rows = [];
    let invalid = 0;
    let duplicates = 0;

    for (const raw of legacy.expenses) {
      const mapped = mapLegacyExpense(raw, categoriesByName, accountResult.accountIds);
      if (!mapped) { invalid++; continue; }
      if (!state.expenseAccountAvailable) delete mapped.account_id;
      const fingerprint = expenseFingerprint(mapped);
      if (existing.has(fingerprint)) { duplicates++; continue; }
      existing.add(fingerprint);
      rows.push({ ...mapped, user_id: state.user.id });
    }

    for (let index = 0; index < rows.length; index += 100) {
      await restInsert("expenses", rows.slice(index, index + 100));
    }

    const monthlyLimit = parseBRL(legacy.settings?.monthlyLimit);
    if (Number.isFinite(monthlyLimit) && monthlyLimit > 0) {
      const { year, month } = currentPeriod();
      await restInsert("monthly_settings", { user_id: state.user.id, year, month, monthly_limit: monthlyLimit }, { upsert: true, onConflict: "user_id,year,month" });
    }
    const categoryLimits = await importCategoryLimits(legacy.settings, categoriesByName);
    await loadData();
    const report = `${rows.length} gasto(s) importado(s), ${duplicates} duplicado(s), ${invalid} inválido(s), ${accountResult.imported} conta(s) e ${categoryLimits} limite(s) de categoria.`;
    $("#import-report").textContent = report;
    toast("Backup importado com sucesso.");
  } catch (error) {
    toast(error.message || "Não foi possível importar o backup.", "error");
  } finally { setButtonBusy(button, false); }
}

function toggleAuth(mode) {
  const login = mode === "login";
  $("#login-form").classList.toggle("hidden", !login);
  $("#signup-form").classList.toggle("hidden", login);
  $("#show-login").classList.toggle("active", login);
  $("#show-signup").classList.toggle("active", !login);
  $("#show-login").setAttribute("aria-selected", String(login));
  $("#show-signup").setAttribute("aria-selected", String(!login));
}

async function handleLogin(event) {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button[type=submit]");
  setButtonBusy(button, true, "Entrando…");
  try {
    await signIn($("#login-email").value.trim(), $("#login-password").value);
    state.user = await getUser();
    showOnly("#app-view");
    await loadData();
  } catch (error) {
    toast(error.message || "Não foi possível entrar.", "error");
  } finally { setButtonBusy(button, false); }
}

async function handleSignup(event) {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button[type=submit]");
  setButtonBusy(button, true, "Criando…");
  try {
    const result = await signUp($("#signup-name").value.trim(), $("#signup-email").value.trim(), $("#signup-password").value);
    if (result?.access_token) {
      saveSession(result);
      state.user = await getUser();
      showOnly("#app-view");
      await loadData();
      toast("Conta criada com sucesso.");
    } else {
      toggleAuth("login");
      $("#login-email").value = $("#signup-email").value.trim();
      toast("Conta criada. Confirme o e-mail e depois entre.");
    }
  } catch (error) {
    toast(error.message || "Não foi possível criar a conta.", "error");
  } finally { setButtonBusy(button, false); }
}

function wireEvents() {
  $("#show-login").addEventListener("click", () => toggleAuth("login"));
  $("#show-signup").addEventListener("click", () => toggleAuth("signup"));
  $("#forgot-password").addEventListener("click", requestPasswordReset);
  $("#login-form").addEventListener("submit", handleLogin);
  $("#signup-form").addEventListener("submit", handleSignup);
  $("#password-form").addEventListener("submit", updatePassword);
  $("#account-form").addEventListener("submit", submitAccount);
  $("#expense-form").addEventListener("submit", submitExpense);
  $("#limit-form").addEventListener("submit", submitLimit);
  $("#import-button").addEventListener("click", importBackup);
  $("#logout-button").addEventListener("click", signOut);
  $("#refresh-button").addEventListener("click", () => loadData({ announce: true }).catch((error) => toast(error.message, "error")));
  $("#retry-button").addEventListener("click", () => window.location.reload());
  document.addEventListener("click", (event) => {
    const target = event.target.closest?.("[data-panel], [data-go]");
    if (!target) return;
    openPanel(target.dataset.panel || target.dataset.go);
  });
  window.addEventListener("hashchange", () => {
    const panel = window.location.hash.slice(1);
    if (["dashboard", "accounts", "expenses", "settings"].includes(panel)) openPanel(panel);
  });
}

async function loadConfig() {
  const response = await fetch("/api/config", { headers: { Accept: "application/json" } });
  const payload = await readResponse(response);
  if (!response.ok) throw new Error(payload?.error || "Configure o banco no ambiente de hospedagem.");
  if (!payload?.supabaseUrl || !payload?.supabasePublishableKey) throw new Error("A configuração pública do Supabase está incompleta.");
  state.config = payload;
}

async function start() {
  wireEvents();
  $("#expense-date").value = todayISO();
  try {
    await loadConfig();
    const authCallback = consumeAuthCallback();
    if (authCallback.error) {
      showOnly("#auth-view");
      toast(authCallback.error, "error");
      return;
    }
    state.recoveryMode = authCallback.type === "recovery";
    state.session = authCallback.session || restoreSession();
    if (!state.session) return showOnly("#auth-view");
    try {
      state.user = await getUser();
    } catch {
      await refreshSession();
      state.user = await getUser();
    }
    showOnly("#app-view");
    await loadData();
    if (state.recoveryMode) {
      openPanel("settings");
      $("#new-password").focus();
      toast("Defina sua nova senha para concluir a recuperação.");
      return;
    }
    const requestedPanel = window.location.hash.slice(1);
    if (["dashboard", "accounts", "expenses", "settings"].includes(requestedPanel)) openPanel(requestedPanel);
  } catch (error) {
    $("#fatal-message").textContent = error.message || "Não foi possível iniciar o aplicativo.";
    showOnly("#fatal-view");
  }
}

start();
