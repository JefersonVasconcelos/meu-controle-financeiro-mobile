const categories = [
  "Alimentação",
  "Mercado",
  "Transporte",
  "Moradia",
  "Saúde",
  "Educação",
  "Lazer",
  "Assinaturas",
  "Compras",
  "Serviços",
  "Impostos",
  "Equipamentos",
  "Outros",
];

const paymentMethods = ["Pix", "Cartão de crédito", "Cartão de débito", "Dinheiro", "Boleto", "Transferência"];
const processingLabels = [
  "Enviando imagem.",
  "Lendo comprovante.",
  "Identificando a compra.",
  "Organizando os valores.",
  "Salvando o gasto.",
  "Atualizando o controle financeiro.",
];

const storageKey = "controleFinanceiro:v2";
const pinKey = "controleFinanceiro:pin";
const pinHashKey = "controleFinanceiro:pinHash";
const authSessionKey = "controleFinanceiro:authSession";
const cloudMetaKey = "controleFinanceiro:cloudMeta:v1";
const authSessionDuration = 12 * 60 * 60 * 1000;

const initialDate = new Date();
let selectedMonth = new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
let selectedFile = null;
let pendingReview = null;
let selectedExpenseId = null;
let reviewMode = "create";
let lastFocusedElement = null;
let lastDeletedExpense = null;
let toastTimer = null;
let cloudSyncTimer = null;
let cloudPollTimer = null;
let cloudSyncPromise = null;

const sampleExpenses = [
  {
    id: "sample-1",
    data_registro: "2026-07-02",
    fornecedor: "Mercado Central",
    cnpj_fornecedor: "12.345.678/0001-90",
    numero_nota: "NF-10293",
    data_emissao: "2026-07-02",
    data_vencimento: "",
    status_vencimento: "Em dia",
    categoria: "Mercado",
    descricao: "Compras da semana",
    forma_pagamento: "Cartão de crédito",
    valor_produtos: 286.7,
    valor_frete: 0,
    valor_desconto: 12,
    valor_total: 274.7,
    status_pagamento: "Pago",
    itens_json: [{ nome: "Alimentos e limpeza", valor: 274.7 }],
    dica_financeira: "Compras agrupadas ajudam a reduzir idas extras ao mercado.",
    alerta_financeiro: "",
    confianca_leitura: 0.96,
    observacoes: "",
    origem: "Nota fiscal",
  },
  {
    id: "sample-2",
    data_registro: "2026-07-07",
    fornecedor: "Posto Avenida",
    cnpj_fornecedor: "22.333.444/0001-10",
    numero_nota: "87012",
    data_emissao: "2026-07-07",
    data_vencimento: "",
    status_vencimento: "Em dia",
    categoria: "Transporte",
    descricao: "Combustível",
    forma_pagamento: "Pix",
    valor_produtos: 180,
    valor_frete: 0,
    valor_desconto: 0,
    valor_total: 180,
    status_pagamento: "Pago",
    itens_json: [{ nome: "Combustível", valor: 180 }],
    dica_financeira: "Acompanhe este gasto semanalmente para evitar surpresa no fim do mês.",
    alerta_financeiro: "",
    confianca_leitura: 0.91,
    observacoes: "",
    origem: "Comprovante",
  },
  {
    id: "sample-3",
    data_registro: "2026-07-11",
    fornecedor: "",
    cnpj_fornecedor: "",
    numero_nota: "",
    data_emissao: "2026-07-11",
    data_vencimento: "2026-07-20",
    status_vencimento: "A vencer",
    categoria: "Assinaturas",
    descricao: "Streaming e armazenamento",
    forma_pagamento: "Cartão de crédito",
    valor_produtos: 74.8,
    valor_frete: 0,
    valor_desconto: 0,
    valor_total: 74.8,
    status_pagamento: "Pendente",
    itens_json: [],
    dica_financeira: "Revise assinaturas sem uso antes de renovar.",
    alerta_financeiro: "Conta vence em poucos dias.",
    confianca_leitura: 1,
    observacoes: "",
    origem: "Registro manual",
  },
  {
    id: "sample-4",
    data_registro: "2026-06-05",
    fornecedor: "Farmácia Vida",
    cnpj_fornecedor: "",
    numero_nota: "5510",
    data_emissao: "2026-06-05",
    data_vencimento: "",
    status_vencimento: "Em dia",
    categoria: "Saúde",
    descricao: "Medicamentos",
    forma_pagamento: "Cartão de débito",
    valor_produtos: 136.9,
    valor_frete: 0,
    valor_desconto: 0,
    valor_total: 136.9,
    status_pagamento: "Pago",
    itens_json: [],
    dica_financeira: "",
    alerta_financeiro: "",
    confianca_leitura: 0.94,
    observacoes: "",
    origem: "Nota fiscal",
  },
  {
    id: "sample-5",
    data_registro: "2026-06-18",
    fornecedor: "",
    cnpj_fornecedor: "",
    numero_nota: "",
    data_emissao: "2026-06-18",
    data_vencimento: "",
    status_vencimento: "Em dia",
    categoria: "Lazer",
    descricao: "Restaurante",
    forma_pagamento: "Pix",
    valor_produtos: 210,
    valor_frete: 0,
    valor_desconto: 0,
    valor_total: 210,
    status_pagamento: "Pago",
    itens_json: [],
    dica_financeira: "",
    alerta_financeiro: "",
    confianca_leitura: 1,
    observacoes: "",
    origem: "Registro manual",
  },
];

const defaultState = {
  settings: {
    monthlyLimit: 2200,
    cycleStartDay: 1,
    savingsGoal: 300,
    monthlyIncome: 3500,
    emergencyReserveCurrent: 1500,
    emergencyReserveGoal: 9000,
    webhookUrl: "",
    categoryLimits: {
      Mercado: 650,
      Transporte: 450,
      Moradia: 700,
      Lazer: 250,
      Assinaturas: 150,
    },
  },
  expenses: sampleExpenses,
  deletedExpenses: [],
  demoMode: true,
  filters: {
    categoria: "",
    status_pagamento: "",
    forma_pagamento: "",
    minValue: "",
    maxValue: "",
    startDate: "",
    endDate: "",
    sortBy: "recent",
  },
};

let state = loadState();
selectedMonth = cycleAnchorForDate(localDateKey(todayLocal()));

const dom = {
  authScreen: document.querySelector("#authScreen"),
  appShell: document.querySelector("#appShell"),
  pinInput: document.querySelector("#pinInput"),
  authButton: document.querySelector("#authButton"),
  authMessage: document.querySelector("#authMessage"),
  lockApp: document.querySelector("#lockApp"),
  currentMonthLabel: document.querySelector("#currentMonthLabel"),
  prevMonth: document.querySelector("#prevMonth"),
  nextMonth: document.querySelector("#nextMonth"),
  availableValue: document.querySelector("#availableValue"),
  budgetValue: document.querySelector("#budgetValue"),
  savingsValue: document.querySelector("#savingsValue"),
  spentValue: document.querySelector("#spentValue"),
  budgetHint: document.querySelector("#budgetHint"),
  budgetPercent: document.querySelector("#budgetPercent"),
  budgetBar: document.querySelector("#budgetBar"),
  remainingDays: document.querySelector("#remainingDays"),
  metricsGrid: document.querySelector("#metricsGrid"),
  summaryList: document.querySelector("#summaryList"),
  monthComparisonBadge: document.querySelector("#monthComparisonBadge"),
  homeAlerts: document.querySelector("#homeAlerts"),
  alertsList: document.querySelector("#alertsList"),
  healthBadge: document.querySelector("#healthBadge"),
  healthScore: document.querySelector("#healthScore"),
  healthMessage: document.querySelector("#healthMessage"),
  healthScoreRing: document.querySelector("#healthScoreRing"),
  planningMetrics: document.querySelector("#planningMetrics"),
  projectionBadge: document.querySelector("#projectionBadge"),
  projectionSummary: document.querySelector("#projectionSummary"),
  reserveBadge: document.querySelector("#reserveBadge"),
  reserveBar: document.querySelector("#reserveBar"),
  reserveSummary: document.querySelector("#reserveSummary"),
  categoryPlanning: document.querySelector("#categoryPlanning"),
  planningActions: document.querySelector("#planningActions"),
  expensesList: document.querySelector("#expensesList"),
  searchInput: document.querySelector("#searchInput"),
  staleBanner: document.querySelector("#staleBanner"),
  demoBanner: document.querySelector("#demoBanner"),
  clearDemoData: document.querySelector("#clearDemoData"),
  refreshDashboard: document.querySelector("#refreshDashboard"),
  refreshData: document.querySelector("#refreshData"),
  cloudStatus: document.querySelector("#cloudStatus"),
  cloudStatusText: document.querySelector("#cloudStatusText"),
  syncNowTop: document.querySelector("#syncNowTop"),
  syncNow: document.querySelector("#syncNow"),
  cloudRevision: document.querySelector("#cloudRevision"),
  cloudAccount: document.querySelector("#cloudAccount"),
  cloudMessage: document.querySelector("#cloudMessage"),
  exportBackup: document.querySelector("#exportBackup"),
  importBackup: document.querySelector("#importBackup"),
  showUpload: document.querySelector("#showUpload"),
  showManual: document.querySelector("#showManual"),
  uploadPanel: document.querySelector("#uploadPanel"),
  manualPanel: document.querySelector("#manualPanel"),
  receiptInput: document.querySelector("#receiptInput"),
  receiptPreview: document.querySelector("#receiptPreview"),
  emptyUploadState: document.querySelector("#emptyUploadState"),
  removeImage: document.querySelector("#removeImage"),
  sendReceipt: document.querySelector("#sendReceipt"),
  processingSteps: document.querySelector("#processingSteps"),
  uploadMessage: document.querySelector("#uploadMessage"),
  manualForm: document.querySelector("#manualForm"),
  settingsForm: document.querySelector("#settingsForm"),
  categoryLimits: document.querySelector("#categoryLimits"),
  categoryChartSummary: document.querySelector("#categoryChartSummary"),
  weekChartSummary: document.querySelector("#weekChartSummary"),
  evolutionChartSummary: document.querySelector("#evolutionChartSummary"),
  statusChartSummary: document.querySelector("#statusChartSummary"),
  reviewModal: document.querySelector("#reviewModal"),
  reviewTitle: document.querySelector("#reviewTitle"),
  reviewEyebrow: document.querySelector("#reviewEyebrow"),
  reviewForm: document.querySelector("#reviewForm"),
  closeReview: document.querySelector("#closeReview"),
  cancelReview: document.querySelector("#cancelReview"),
  editReview: document.querySelector("#editReview"),
  confirmReview: document.querySelector("#confirmReview"),
  confidenceWarning: document.querySelector("#confidenceWarning"),
  detailModal: document.querySelector("#detailModal"),
  detailTitle: document.querySelector("#detailTitle"),
  detailContent: document.querySelector("#detailContent"),
  closeDetail: document.querySelector("#closeDetail"),
  editExpense: document.querySelector("#editExpense"),
  markPaid: document.querySelector("#markPaid"),
  markPending: document.querySelector("#markPending"),
  shareExpense: document.querySelector("#shareExpense"),
  deleteExpense: document.querySelector("#deleteExpense"),
  filterDrawer: document.querySelector("#filterDrawer"),
  filterForm: document.querySelector("#filterForm"),
  openFilters: document.querySelector("#openFilters"),
  closeFilters: document.querySelector("#closeFilters"),
  clearFilters: document.querySelector("#clearFilters"),
  toastRegion: document.querySelector("#toastRegion"),
  toastMessage: document.querySelector("#toastMessage"),
  toastAction: document.querySelector("#toastAction"),
};

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(defaultState);
  try {
    const parsed = JSON.parse(saved);
    const base = structuredClone(defaultState);
    const expenses = Array.isArray(parsed.expenses) ? parsed.expenses.map((expense) => normalizeExpense(expense)) : base.expenses;
    const demoMode = typeof parsed.demoMode === "boolean"
      ? parsed.demoMode
      : expenses.length > 0 && expenses.every((expense) => String(expense.id).startsWith("sample-"));
    const settings = { ...base.settings, ...(parsed.settings || {}) };
    settings.monthlyLimit = Math.max(0, Number(settings.monthlyLimit || 0));
    settings.savingsGoal = Math.max(0, Number(settings.savingsGoal || 0));
    settings.monthlyIncome = Math.max(0, Number(settings.monthlyIncome || 0));
    settings.emergencyReserveCurrent = Math.max(0, Number(settings.emergencyReserveCurrent || 0));
    settings.emergencyReserveGoal = Math.max(0, Number(settings.emergencyReserveGoal || 0));
    settings.cycleStartDay = Math.min(28, Math.max(1, Number(settings.cycleStartDay || 1)));
    settings.categoryLimits = normalizeCategoryLimits(settings.categoryLimits);
    const deletedExpenses = normalizeDeletedExpenses(parsed.deletedExpenses);
    return {
      ...base,
      ...parsed,
      expenses,
      deletedExpenses,
      demoMode,
      settings,
      filters: { ...base.filters, ...(parsed.filters || {}) },
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function loadCloudMeta() {
  const parsed = parseJson(localStorage.getItem(cloudMetaKey), {});
  return {
    revision: Math.max(0, Number(parsed?.revision || 0)),
    pending: Boolean(parsed?.pending),
    initialized: Boolean(parsed?.initialized),
    updatedAt: normalizeTimestamp(parsed?.updatedAt),
    email: safeText(parsed?.email, 320),
  };
}

function saveCloudMeta(meta) {
  localStorage.setItem(cloudMetaKey, JSON.stringify(meta));
}

function financialStateSnapshot(source = state) {
  const normalized = normalizeFinancialState(source);
  return {
    settings: normalized.settings,
    expenses: normalized.expenses,
    deletedExpenses: normalized.deletedExpenses,
    demoMode: normalized.demoMode,
  };
}

function normalizeFinancialState(source) {
  const input = source && typeof source === "object" ? source : {};
  const currentSettings = input.settings && typeof input.settings === "object" ? input.settings : {};
  const settings = {
    monthlyLimit: Math.max(0, Number(currentSettings.monthlyLimit || 0)),
    cycleStartDay: Math.min(28, Math.max(1, Number(currentSettings.cycleStartDay || 1))),
    savingsGoal: Math.max(0, Number(currentSettings.savingsGoal || 0)),
    monthlyIncome: Math.max(0, Number(currentSettings.monthlyIncome || 0)),
    emergencyReserveCurrent: Math.max(0, Number(currentSettings.emergencyReserveCurrent || 0)),
    emergencyReserveGoal: Math.max(0, Number(currentSettings.emergencyReserveGoal || 0)),
    categoryLimits: normalizeCategoryLimits(currentSettings.categoryLimits),
  };
  const deletedExpenses = normalizeDeletedExpenses(input.deletedExpenses);
  const deletedById = new Map(deletedExpenses.map((item) => [item.id, item.deleted_at]));
  const expenses = (Array.isArray(input.expenses) ? input.expenses : [])
    .slice(0, 5000)
    .map((expense) => normalizeExpense(expense))
    .filter((expense) => !deletedById.has(expense.id) || deletedById.get(expense.id) < expense.updated_at);
  const uniqueExpenses = [...expenses.reduce((map, expense) => {
    const current = map.get(expense.id);
    if (!current || expense.updated_at >= current.updated_at) map.set(expense.id, expense);
    return map;
  }, new Map()).values()];
  const demoMode = Boolean(input.demoMode) && uniqueExpenses.every((expense) => String(expense.id).startsWith("sample-"));
  return { settings, expenses: uniqueExpenses, deletedExpenses, demoMode };
}

function mergeFinancialStates(baseState, incomingState, preferIncomingSettings = true) {
  const base = normalizeFinancialState(baseState);
  const incoming = normalizeFinancialState(incomingState);
  const tombstones = normalizeDeletedExpenses([...base.deletedExpenses, ...incoming.deletedExpenses]);
  const expenseMap = new Map();
  [...base.expenses, ...incoming.expenses].forEach((expense) => {
    const current = expenseMap.get(expense.id);
    if (!current || expense.updated_at >= current.updated_at) expenseMap.set(expense.id, expense);
  });
  const deletedById = new Map(tombstones.map((item) => [item.id, item.deleted_at]));
  const expenses = [...expenseMap.values()].filter((expense) => !deletedById.has(expense.id) || deletedById.get(expense.id) < expense.updated_at);
  return {
    settings: preferIncomingSettings ? incoming.settings : base.settings,
    expenses,
    deletedExpenses: tombstones,
    demoMode: base.demoMode && incoming.demoMode && expenses.every((expense) => String(expense.id).startsWith("sample-")),
  };
}

function applyFinancialState(snapshot) {
  const normalized = normalizeFinancialState(snapshot);
  const localWebhookUrl = state.settings.webhookUrl || "";
  state = {
    ...state,
    settings: { ...state.settings, ...normalized.settings, webhookUrl: localWebhookUrl },
    expenses: normalized.expenses,
    deletedExpenses: normalized.deletedExpenses,
    demoMode: normalized.demoMode,
  };
  saveState();
  render();
}

function markCloudChange() {
  const meta = loadCloudMeta();
  meta.pending = true;
  meta.initialized = true;
  saveCloudMeta(meta);
  saveState();
  setCloudStatus("local", "Alterações aguardando sincronização", "Alterações guardadas neste aparelho até a próxima sincronização.");
  scheduleCloudSync();
}

function scheduleCloudSync() {
  window.clearTimeout(cloudSyncTimer);
  cloudSyncTimer = window.setTimeout(() => {
    if (!dom.appShell.classList.contains("is-hidden")) syncCloud();
  }, 1500);
}

function setCloudStatus(kind, text, message = "") {
  dom.cloudStatus.classList.remove("is-local", "is-synced", "is-syncing", "is-offline", "is-error");
  dom.cloudStatus.classList.add(`is-${kind}`);
  dom.cloudStatusText.textContent = text;
  if (message) dom.cloudMessage.textContent = message;
  const meta = loadCloudMeta();
  dom.cloudRevision.textContent = meta.revision ? `Versão sincronizada ${meta.revision}` : "Ainda não sincronizado";
  if (meta.email) dom.cloudAccount.textContent = meta.email;
}

async function syncCloud(options = {}) {
  if (cloudSyncPromise) return cloudSyncPromise;
  cloudSyncPromise = performCloudSync(options).finally(() => { cloudSyncPromise = null; });
  return cloudSyncPromise;
}

async function performCloudSync({ manual = false } = {}) {
  setCloudStatus("syncing", "Sincronizando…", manual ? "Conferindo a versão mais recente dos seus dados." : "");
  dom.syncNow.disabled = true;
  dom.syncNowTop.disabled = true;
  try {
    const remote = await cloudRequest("/api/state", { cache: "no-store" });
    const meta = loadCloudMeta();
    meta.initialized = true;
    meta.email = safeText(remote.user?.email, 320);
    dom.cloudAccount.textContent = meta.email || "Conta autenticada";
    const localSnapshot = financialStateSnapshot();
    if (!meta.pending && meta.revision === 0 && (!localSnapshot.demoMode || localSnapshot.expenses.some((expense) => !String(expense.id).startsWith("sample-")))) {
      meta.pending = true;
    }

    if (!remote.state) {
      saveCloudMeta(meta);
      if (meta.pending || !localSnapshot.demoMode) {
        await pushCloudState(localSnapshot, 0);
      } else {
        meta.pending = false;
        meta.revision = 0;
        saveCloudMeta(meta);
        setCloudStatus("synced", "Nuvem pronta", "Quando você cadastrar seu primeiro gasto, ele será sincronizado automaticamente.");
      }
      return;
    }

    const remoteSnapshot = normalizeFinancialState(remote.state);
    if (meta.pending) {
      const snapshotToPush = meta.revision === Number(remote.revision)
        ? localSnapshot
        : mergeFinancialStates(remoteSnapshot, localSnapshot, true);
      await pushCloudState(snapshotToPush, Number(remote.revision));
    } else {
      applyFinancialState(remoteSnapshot);
      meta.revision = Number(remote.revision || 0);
      meta.updatedAt = normalizeTimestamp(remote.updatedAt);
      meta.pending = false;
      saveCloudMeta(meta);
      setCloudStatus("synced", `Sincronizado ${formatSyncTime(meta.updatedAt)}`, "Dados atualizados a partir da sua conta.");
    }
  } catch (error) {
    const pending = loadCloudMeta().pending;
    const offline = navigator.onLine === false || error?.name === "TypeError";
    setCloudStatus(
      offline ? "offline" : "error",
      offline ? "Offline — dados protegidos no aparelho" : "Sincronização indisponível",
      pending ? "Suas alterações estão guardadas e serão enviadas quando a conexão voltar." : "Não foi possível conferir a nuvem agora. Seus dados locais foram mantidos.",
    );
  } finally {
    dom.syncNow.disabled = false;
    dom.syncNowTop.disabled = false;
  }
}

async function pushCloudState(snapshot, expectedRevision, retry = true) {
  try {
    const result = await cloudRequest("/api/state", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state: snapshot, expectedRevision }),
    });
    applyFinancialState(result.state || snapshot);
    const meta = loadCloudMeta();
    meta.revision = Number(result.revision || expectedRevision + 1);
    meta.updatedAt = normalizeTimestamp(result.updatedAt) || new Date().toISOString();
    meta.pending = false;
    meta.initialized = true;
    meta.email = safeText(result.user?.email || meta.email, 320);
    saveCloudMeta(meta);
    setCloudStatus("synced", `Sincronizado ${formatSyncTime(meta.updatedAt)}`, "Backup em nuvem atualizado com sucesso.");
  } catch (error) {
    if (error.status === 409 && retry && error.payload?.state) {
      const merged = mergeFinancialStates(error.payload.state, snapshot, true);
      return pushCloudState(merged, Number(error.payload.revision || 0), false);
    }
    throw error;
  }
}

async function cloudRequest(path, options = {}) {
  const response = await fetch(path, { credentials: "same-origin", ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "Falha na sincronização.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function formatSyncTime(value) {
  const parsed = new Date(value || "");
  if (Number.isNaN(parsed.valueOf())) return "agora";
  return `às ${parsed.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function initializeCloudSync() {
  window.clearInterval(cloudPollTimer);
  syncCloud();
  cloudPollTimer = window.setInterval(() => {
    if (document.visibilityState !== "hidden" && !dom.appShell.classList.contains("is-hidden")) syncCloud();
  }, 60000);
}

function exportFinancialBackup() {
  const backup = {
    format: "meu-controle-financeiro",
    version: 2,
    exported_at: new Date().toISOString(),
    state: financialStateSnapshot(),
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `meu-controle-financeiro-${localDateKey(todayLocal())}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Backup exportado.");
}

async function importFinancialBackup(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    showToast("O backup deve ter no máximo 2 MB.");
    return;
  }
  try {
    const parsed = JSON.parse(await file.text());
    const imported = normalizeFinancialState(parsed?.state || parsed);
    if (!Array.isArray((parsed?.state || parsed)?.expenses)) throw new Error("Formato inválido");
    const merged = mergeFinancialStates(financialStateSnapshot(), imported, true);
    applyFinancialState(merged);
    markCloudChange();
    showToast("Backup importado e mesclado.");
    syncCloud({ manual: true });
  } catch {
    showToast("Não foi possível importar este arquivo de backup.");
  }
}

function currency(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function dateBR(value) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function todayLocal() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseLocalDate(value) {
  const normalized = normalizeDate(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function getCycleBounds(anchor = selectedMonth) {
  const startDay = Math.min(28, Math.max(1, Number(state.settings.cycleStartDay || 1)));
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), startDay);
  const endExclusive = new Date(anchor.getFullYear(), anchor.getMonth() + 1, startDay);
  const end = new Date(endExclusive.getFullYear(), endExclusive.getMonth(), endExclusive.getDate() - 1);
  return { start, end, endExclusive };
}

function cycleExpenses(anchor = selectedMonth) {
  const { start, endExclusive } = getCycleBounds(anchor);
  return state.expenses.filter((expense) => {
    const expenseDate = parseLocalDate(expense.data_emissao || expense.data_registro);
    return expenseDate && expenseDate >= start && expenseDate < endExclusive;
  });
}

function selectedExpenses() {
  return cycleExpenses(selectedMonth);
}

function previousMonthExpenses() {
  return cycleExpenses(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1));
}

function cycleAnchorForDate(value) {
  const date = parseLocalDate(value) || todayLocal();
  const startDay = Math.min(28, Math.max(1, Number(state.settings.cycleStartDay || 1)));
  const monthOffset = date.getDate() < startDay ? -1 : 0;
  return new Date(date.getFullYear(), date.getMonth() + monthOffset, 1);
}

function formatCycleLabel(bounds) {
  if (bounds.start.getDate() === 1) {
    return bounds.start.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "");
  }
  const start = bounds.start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
  const end = bounds.end.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");
  return `${start} – ${end}`;
}

function sum(list, selector) {
  return list.reduce((total, item) => total + Number(selector(item) || 0), 0);
}

function sanitizeText(value) {
  return String(value ?? "").replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[char]));
}

function getBudgetColor(percent) {
  if (percent > 100) return "var(--red)";
  if (percent > 90) return "var(--orange)";
  if (percent > 70) return "var(--yellow)";
  return "var(--green)";
}

function getStats() {
  const expenses = selectedExpenses();
  const previous = previousMonthExpenses();
  const cycle = getCycleBounds();
  const today = todayLocal();
  const cycleDays = Math.round((cycle.endExclusive - cycle.start) / 86400000);
  const position = today < cycle.start ? "future" : today >= cycle.endExclusive ? "past" : "current";
  const elapsedDays = position === "future"
    ? 0
    : position === "past"
      ? cycleDays
      : Math.floor((today - cycle.start) / 86400000) + 1;
  const remainingDays = position === "current" ? Math.max(0, Math.round((cycle.endExclusive - today) / 86400000)) : 0;
  const total = sum(expenses, (expense) => expense.valor_total);
  const previousTotal = sum(previous, (expense) => expense.valor_total);
  const paid = sum(expenses.filter((expense) => expense.status_pagamento === "Pago"), (expense) => expense.valor_total);
  const pending = sum(expenses.filter((expense) => expense.status_pagamento === "Pendente"), (expense) => expense.valor_total);
  const largest = expenses.reduce((max, expense) => (Number(expense.valor_total) > Number(max?.valor_total || 0) ? expense : max), null);
  const categoryTotals = groupTotals(expenses, "categoria");
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  const dailyAverage = elapsedDays ? total / elapsedDays : 0;
  const avgPurchase = expenses.length ? total / expenses.length : 0;
  const monthlyLimit = Math.max(0, Number(state.settings.monthlyLimit || 0));
  const savingsGoal = Math.max(0, Number(state.settings.savingsGoal || 0));
  const spendingBudget = Math.max(0, monthlyLimit - savingsGoal);
  const percentUsed = spendingBudget ? (total / spendingBudget) * 100 : total ? 100 : 0;
  const available = spendingBudget - total;
  const projected = position === "current" ? dailyAverage * cycleDays : position === "past" ? total : 0;

  return { expenses, previous, total, previousTotal, paid, pending, largest, categoryTotals, topCategory, dailyAverage, avgPurchase, percentUsed, available, monthlyLimit, savingsGoal, spendingBudget, projected, cycle, cycleDays, elapsedDays, remainingDays, position };
}

function groupTotals(expenses, key) {
  return expenses.reduce((acc, expense) => {
    const group = expense[key] || "Outros";
    acc[group] = (acc[group] || 0) + Number(expense.valor_total || 0);
    return acc;
  }, {});
}

function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function render() {
  const stats = getStats();
  dom.currentMonthLabel.textContent = formatCycleLabel(stats.cycle);
  dom.availableValue.textContent = currency(stats.available);
  dom.budgetValue.textContent = currency(stats.spendingBudget);
  dom.savingsValue.textContent = currency(stats.savingsGoal);
  dom.spentValue.textContent = `Gasto: ${currency(stats.total)}`;
  dom.budgetPercent.textContent = `${Math.round(stats.percentUsed)}%`;
  dom.budgetBar.style.width = `${Math.min(100, stats.percentUsed)}%`;
  dom.budgetBar.style.background = getBudgetColor(stats.percentUsed);
  dom.remainingDays.textContent = stats.position === "current"
    ? `${stats.remainingDays} ${stats.remainingDays === 1 ? "dia" : "dias"} até o fim`
    : stats.position === "past"
      ? "Ciclo encerrado"
      : "Ciclo futuro";
  dom.budgetHint.textContent = projectedMessage(stats);
  dom.demoBanner.classList.toggle("is-hidden", !state.demoMode);

  renderMetrics(stats);
  renderSummary(stats);
  renderAlerts(stats);
  renderPlanning(stats);
  renderExpenses();
  renderSettings();
  drawCharts(stats);
  saveState();
}

async function refreshDataNow() {
  const originalLabel = dom.refreshData.textContent;
  dom.refreshData.disabled = true;
  dom.refreshData.textContent = "Recarregando...";
  dom.refreshData.classList.remove("is-updated");

  state = loadState();
  dom.staleBanner.classList.add("is-hidden");
  render();
  await syncCloud({ manual: true });
  await navigator.serviceWorker?.getRegistration?.().then((registration) => registration?.update()).catch(() => null);

  dom.refreshData.textContent = "Painel recarregado";
  dom.refreshData.classList.add("is-updated");
  window.setTimeout(() => {
    dom.refreshData.disabled = false;
    dom.refreshData.textContent = originalLabel.trim() || "Recarregar painel";
    dom.refreshData.classList.remove("is-updated");
  }, 1400);
}

function projectedMessage(stats) {
  if (stats.position === "past") {
    return `Ciclo encerrado em ${dateBR(localDateKey(stats.cycle.end))}. Total gasto: ${currency(stats.total)}.`;
  }
  if (stats.position === "future") {
    return `Este ciclo começa em ${dateBR(localDateKey(stats.cycle.start))}. A projeção será exibida após o primeiro dia.`;
  }
  if (stats.projected > stats.spendingBudget) {
    return `No ritmo atual, a projeção é ${currency(stats.projected)} e pode ultrapassar seu orçamento para gastar.`;
  }
  return `Projeção até o fim do ciclo: ${currency(stats.projected)}.`;
}

function renderMetrics(stats) {
  const metrics = [
    ["Total gasto no ciclo", currency(stats.total)],
    ["Orçamento restante", currency(stats.available)],
    ["Contas pendentes", currency(stats.pending)],
    ["Categoria com maior gasto", stats.topCategory ? stats.topCategory[0] : "-"],
  ];
  dom.metricsGrid.innerHTML = metrics.map(([label, value]) => `<article class="metric-card"><span>${sanitizeText(label)}</span><strong>${sanitizeText(value)}</strong></article>`).join("");
}

function renderSummary(stats) {
  const diff = stats.previousTotal ? ((stats.total - stats.previousTotal) / stats.previousTotal) * 100 : 0;
  const comparison = stats.previousTotal
    ? `${stats.total > stats.previousTotal ? "Gastou mais" : "Gastou menos"}: ${Math.abs(diff).toFixed(1).replace(".", ",")}%`
    : "Sem ciclo anterior";
  dom.monthComparisonBadge.textContent = comparison;

  const currentCategories = stats.categoryTotals;
  const prevCategories = groupTotals(stats.previous, "categoria");
  const deltas = categories.map((category) => [category, (currentCategories[category] || 0) - (prevCategories[category] || 0)]);
  const increased = [...deltas].sort((a, b) => b[1] - a[1])[0];
  const reduced = [...deltas].sort((a, b) => a[1] - b[1])[0];

  const items = [
    ["Total gasto", currency(stats.total)],
    ["Quantidade de compras", stats.expenses.length],
    ["Maior compra do ciclo", stats.largest ? `${stats.largest.fornecedor || stats.largest.descricao} (${currency(stats.largest.valor_total)})` : "-"],
    ["Média por compra", currency(stats.avgPurchase)],
    ["Média diária", stats.position === "future" ? "Ciclo ainda não iniciado" : currency(stats.dailyAverage)],
    ["Total pago", currency(stats.paid)],
    ["Total pendente", currency(stats.pending)],
    ["Valor disponível no ciclo", currency(stats.monthlyLimit)],
    ["Meta de economia", currency(stats.savingsGoal)],
    ["Orçamento restante", currency(stats.available)],
    ["Categoria que mais aumentou", increased && increased[1] > 0 ? increased[0] : "-"],
    ["Categoria que mais reduziu", reduced && reduced[1] < 0 ? reduced[0] : "-"],
  ];
  dom.summaryList.innerHTML = items.map(([label, value]) => `<div class="summary-item"><span>${label}</span><strong>${sanitizeText(value)}</strong></div>`).join("");
}

function buildAlerts(stats) {
  const alerts = [];
  if (stats.savingsGoal > stats.monthlyLimit) {
    alerts.push({ type: "danger", text: "A meta de economia é maior que o valor disponível no ciclo.", view: "profile", actionLabel: "Ajustar orçamento" });
  } else if (stats.percentUsed >= 100) {
    alerts.push({ type: "danger", text: "Seu orçamento para gastar foi ultrapassado.", view: "profile", actionLabel: "Ajustar orçamento" });
  } else if (stats.percentUsed >= 90) {
    alerts.push({ type: "danger", text: `Você já utilizou ${Math.round(stats.percentUsed)}% do orçamento para gastar.`, view: "profile", actionLabel: "Revisar orçamento" });
  } else if (stats.percentUsed >= 70) {
    alerts.push({ type: "attention", text: `Você já utilizou ${Math.round(stats.percentUsed)}% do orçamento para gastar.`, view: "expenses", actionLabel: "Ver gastos" });
  }

  const today = todayLocal();
  stats.expenses.forEach((expense) => {
    if (expense.status_pagamento !== "Pendente" || !expense.data_vencimento) return;
    const due = parseLocalDate(expense.data_vencimento);
    if (!due) return;
    const days = Math.round((due - today) / 86400000);
    if (days < 0) alerts.push({ type: "danger", text: `${expense.descricao || expense.fornecedor} está vencido.`, expenseId: expense.id, actionLabel: "Ver gasto" });
    else if (days <= 3) alerts.push({ type: "attention", text: `${expense.descricao || expense.fornecedor} vence em até três dias.`, expenseId: expense.id, actionLabel: "Ver gasto" });
  });

  const average = stats.avgPurchase;
  stats.expenses.forEach((expense) => {
    if (average && stats.expenses.length > 1 && Number(expense.valor_total) > average * 2.2) alerts.push({ type: "attention", text: `${expense.descricao || expense.fornecedor} ficou muito acima da média.`, expenseId: expense.id, actionLabel: "Revisar gasto" });
    if (Number(expense.confianca_leitura) < 0.75) alerts.push({ type: "attention", text: "Uma leitura de comprovante está com baixa confiança.", expenseId: expense.id, actionLabel: "Revisar gasto" });
  });

  const seen = new Set();
  stats.expenses.forEach((expense) => {
    const key = `${expense.data_emissao}|${expense.valor_total}|${expense.fornecedor || expense.descricao}`;
    if (seen.has(key)) alerts.push({ type: "attention", text: "Possível compra duplicada identificada.", expenseId: expense.id, actionLabel: "Conferir gasto" });
    seen.add(key);
  });

  Object.entries(state.settings.categoryLimits || {}).forEach(([category, limit]) => {
    if (limit && (stats.categoryTotals[category] || 0) > limit) alerts.push({ type: "danger", text: `${category} ultrapassou o limite definido.`, view: "expenses", actionLabel: "Ver gastos" });
  });

  if (!alerts.length) alerts.push({ type: "success", text: "Nenhum alerta financeiro neste ciclo." });
  return alerts;
}

function renderAlerts(stats) {
  const alerts = buildAlerts(stats);
  renderAlertCards(dom.homeAlerts, alerts.slice(0, 4));
  renderAlertCards(dom.alertsList, alerts);
}

function calculateFinancialHealth(stats) {
  const income = Math.max(0, Number(state.settings.monthlyIncome || 0));
  const reserveCurrent = Math.max(0, Number(state.settings.emergencyReserveCurrent || 0));
  const reserveGoal = Math.max(0, Number(state.settings.emergencyReserveGoal || 0));
  const projectedExpense = stats.projected || stats.total;
  const savingsRate = income ? Math.max(0, (income - projectedExpense) / income) : 0;
  const reserveProgress = reserveGoal ? Math.min(1, reserveCurrent / reserveGoal) : 0;
  const budgetControl = stats.spendingBudget ? Math.max(0, 1 - Math.max(0, stats.percentUsed - 70) / 60) : 0;
  const pendingControl = stats.total ? Math.max(0, 1 - stats.pending / stats.total) : 1;
  const score = income
    ? Math.round(Math.min(100, budgetControl * 35 + Math.min(1, savingsRate / 0.2) * 30 + reserveProgress * 25 + pendingControl * 10))
    : 0;
  return { income, reserveCurrent, reserveGoal, projectedExpense, savingsRate, reserveProgress, score };
}

function renderPlanning(stats) {
  const health = calculateFinancialHealth(stats);
  const projectedBalance = health.income - health.projectedExpense;
  const referenceExpense = Math.max(health.projectedExpense, stats.spendingBudget, 1);
  const reserveMonths = health.reserveCurrent / referenceExpense;
  const dailySafeLimit = stats.remainingDays > 0 ? Math.max(0, stats.available / stats.remainingDays) : 0;
  const scoreLabel = health.score >= 80 ? "Muito boa" : health.score >= 60 ? "Estável" : health.score >= 40 ? "Atenção" : "Crítica";

  dom.healthScore.textContent = `${health.score} de 100`;
  dom.healthScoreRing.textContent = health.score;
  dom.healthBadge.textContent = health.income ? scoreLabel : "Configure sua renda";
  dom.healthMessage.textContent = !health.income
    ? "Informe sua renda líquida mensal no Perfil para ativar o diagnóstico completo."
    : health.score >= 80
      ? "Seu planejamento está equilibrado. Mantenha a disciplina e fortaleça a reserva."
      : health.score >= 60
        ? "Seu orçamento está sob controle, mas ainda há espaço para reforçar a segurança financeira."
        : health.score >= 40
          ? "A projeção pede ajustes no orçamento e na construção da reserva."
          : "Priorize reduzir o ritmo de gastos e organizar contas pendentes.";

  const metrics = [
    ["Renda líquida", health.income ? currency(health.income) : "Não informada"],
    ["Despesa projetada", currency(health.projectedExpense)],
    ["Saldo projetado", health.income ? currency(projectedBalance) : "-"],
    ["Taxa de poupança", health.income ? `${Math.round(health.savingsRate * 100)}%` : "-"],
  ];
  dom.planningMetrics.innerHTML = metrics.map(([label, value]) => `<article class="metric-card"><span>${sanitizeText(label)}</span><strong>${sanitizeText(value)}</strong></article>`).join("");

  dom.projectionBadge.textContent = projectedBalance >= 0 ? "Saldo positivo" : "Risco de déficit";
  dom.projectionSummary.innerHTML = [
    ["Gasto registrado", currency(stats.total)],
    ["Projeção até o fim", currency(health.projectedExpense)],
    ["Limite diário seguro", stats.position === "current" ? currency(dailySafeLimit) : "Ciclo fora do período atual"],
    ["Saldo após a projeção", health.income ? currency(projectedBalance) : "Informe sua renda"],
  ].map(([label, value]) => `<div class="summary-item"><span>${sanitizeText(label)}</span><strong>${sanitizeText(value)}</strong></div>`).join("");

  dom.reserveBar.style.width = `${Math.min(100, health.reserveProgress * 100)}%`;
  dom.reserveBar.style.background = health.reserveProgress >= 1 ? "var(--green)" : "var(--blue-600)";
  dom.reserveBadge.textContent = health.reserveGoal ? `${Math.round(health.reserveProgress * 100)}% da meta` : "Não configurada";
  dom.reserveSummary.textContent = health.reserveGoal
    ? `${currency(health.reserveCurrent)} acumulados de ${currency(health.reserveGoal)}. Cobertura estimada de ${reserveMonths.toFixed(1).replace(".", ",")} meses.`
    : "Defina o valor atual e a meta da reserva no Perfil.";

  const limits = Object.entries(state.settings.categoryLimits || {}).filter(([, limit]) => Number(limit) > 0);
  dom.categoryPlanning.innerHTML = limits.length ? limits.map(([category, limit]) => {
    const spent = Number(stats.categoryTotals[category] || 0);
    const percent = limit ? spent / limit * 100 : 0;
    return `<div class="category-plan-row"><div class="row-between"><span>${sanitizeText(category)}</span><strong>${currency(spent)} de ${currency(limit)}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, percent)}%;background:${getBudgetColor(percent)}"></div></div><small>${Math.round(percent)}% utilizado</small></div>`;
  }).join("") : `<p class="muted">Defina limites por categoria no Perfil para acompanhar o plano.</p>`;

  const actions = [];
  if (!health.income) actions.push("Informe sua renda líquida para calcular saldo e taxa de poupança.");
  if (stats.percentUsed > 90) actions.push("Reduza gastos não essenciais para voltar ao limite do ciclo.");
  if (stats.pending > 0) actions.push(`Organize ${currency(stats.pending)} em contas pendentes antes de novos compromissos.`);
  if (!health.reserveGoal) actions.push("Defina uma meta de reserva de emergência.");
  else if (health.reserveProgress < 1) actions.push(`Direcione parte do saldo mensal para os ${currency(Math.max(0, health.reserveGoal - health.reserveCurrent))} que faltam na reserva.`);
  if (health.income && health.savingsRate < 0.2) actions.push("Busque uma taxa de poupança próxima de 20% da renda, ajustando-a à sua realidade.");
  if (!actions.length) actions.push("Mantenha os limites atuais e revise o planejamento no próximo ciclo.");
  dom.planningActions.innerHTML = actions.slice(0, 5).map((action) => `<li>${sanitizeText(action)}</li>`).join("");
}

function renderAlertCards(container, alerts) {
  container.replaceChildren();
  alerts.forEach((alert) => {
    const card = document.createElement("article");
    card.className = `alert-card ${alert.type === "danger" ? "danger" : alert.type === "success" ? "success" : ""}`.trim();
    const text = document.createElement("span");
    text.textContent = alert.text;
    card.append(text);
    if (alert.actionLabel) {
      const action = document.createElement("button");
      action.type = "button";
      action.className = "text-button";
      action.textContent = alert.actionLabel;
      if (alert.expenseId) action.dataset.alertExpenseId = alert.expenseId;
      if (alert.view) action.dataset.alertView = alert.view;
      card.append(action);
    }
    container.append(card);
  });
}

function renderExpenses() {
  const search = dom.searchInput.value.trim().toLowerCase();
  let expenses = selectedExpenses().filter((expense) => {
    const text = `${expense.fornecedor} ${expense.descricao} ${expense.categoria} ${expense.numero_nota}`.toLowerCase();
    if (search && !text.includes(search)) return false;
    if (state.filters.categoria && expense.categoria !== state.filters.categoria) return false;
    if (state.filters.status_pagamento && expense.status_pagamento !== state.filters.status_pagamento) return false;
    if (state.filters.forma_pagamento && expense.forma_pagamento !== state.filters.forma_pagamento) return false;
    if (state.filters.minValue && Number(expense.valor_total) < Number(state.filters.minValue)) return false;
    if (state.filters.maxValue && Number(expense.valor_total) > Number(state.filters.maxValue)) return false;
    if (state.filters.startDate && expense.data_emissao < state.filters.startDate) return false;
    if (state.filters.endDate && expense.data_emissao > state.filters.endDate) return false;
    return true;
  });

  expenses.sort((a, b) => {
    if (state.filters.sortBy === "oldest") return String(a.data_emissao).localeCompare(String(b.data_emissao));
    if (state.filters.sortBy === "highest") return Number(b.valor_total) - Number(a.valor_total);
    if (state.filters.sortBy === "lowest") return Number(a.valor_total) - Number(b.valor_total);
    return String(b.data_emissao).localeCompare(String(a.data_emissao));
  });

  if (!expenses.length) {
    dom.expensesList.innerHTML = `<article class="expense-card"><strong>Nenhum resultado encontrado.</strong><span class="muted">Tente ajustar a busca ou limpar os filtros.</span></article>`;
    return;
  }

  dom.expensesList.innerHTML = expenses.map((expense) => `
    <button class="expense-card" type="button" data-expense-id="${expense.id}">
      <span class="expense-main">
        <strong>${sanitizeText(expense.fornecedor || expense.descricao)}</strong>
        <span class="amount">${currency(expense.valor_total)}</span>
      </span>
      <span class="expense-meta">
        <span class="pill">${dateBR(expense.data_emissao)}</span>
        <span class="pill">${sanitizeText(expense.categoria)}</span>
        <span class="pill ${expense.status_pagamento === "Pago" ? "paid" : "pending"}">${sanitizeText(expense.status_pagamento)}</span>
        <span class="pill">${sanitizeText(expense.forma_pagamento)}</span>
        <span class="pill">${sanitizeText(expense.origem || "Registro manual")}</span>
      </span>
    </button>
  `).join("");
}

function renderSettings() {
  dom.settingsForm.monthlyLimit.value = state.settings.monthlyLimit;
  dom.settingsForm.cycleStartDay.value = state.settings.cycleStartDay;
  dom.settingsForm.savingsGoal.value = state.settings.savingsGoal;
  dom.settingsForm.monthlyIncome.value = state.settings.monthlyIncome;
  dom.settingsForm.emergencyReserveCurrent.value = state.settings.emergencyReserveCurrent;
  dom.settingsForm.emergencyReserveGoal.value = state.settings.emergencyReserveGoal;
  dom.settingsForm.webhookUrl.value = getWebhookUrl(false);
  dom.categoryLimits.innerHTML = categories.map((category) => `
    <label class="category-limit-row">
      <span>${category}</span>
      <input name="limit_${category}" type="number" min="0" step="0.01" value="${state.settings.categoryLimits?.[category] || ""}" />
    </label>
  `).join("");
}

function drawCharts(stats) {
  const categoryEntries = Object.entries(stats.categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const weeklyEntries = weekTotals(stats.expenses);
  const evolutionEntries = dailyTotals(stats.expenses);
  drawRing("budgetRing", stats.percentUsed);
  drawBarChart("categoryChart", categoryEntries, "#2462a7");
  drawBarChart("weekChart", weeklyEntries, "#1f9d68");
  drawLineChart("evolutionChart", evolutionEntries, "#2462a7");
  drawBarChart("statusChart", [["Pago", stats.paid], ["Pendente", stats.pending]], "#ee7b27");
  document.querySelector("#budgetRing").setAttribute("aria-label", `${Math.round(stats.percentUsed)}% do orçamento para gastar utilizado`);
  dom.categoryChartSummary.textContent = categoryEntries.length
    ? `Maior categoria: ${categoryEntries[0][0]}, com ${currency(categoryEntries[0][1])}.`
    : "Nenhum gasto por categoria neste ciclo.";
  const topWeek = [...weeklyEntries].sort((a, b) => b[1] - a[1])[0];
  dom.weekChartSummary.textContent = topWeek && topWeek[1]
    ? `Maior período semanal: ${topWeek[0]}, com ${currency(topWeek[1])}.`
    : "Nenhum gasto semanal neste ciclo.";
  dom.evolutionChartSummary.textContent = `Total acumulado no ciclo: ${currency(stats.total)}.`;
  dom.statusChartSummary.textContent = `Pago: ${currency(stats.paid)}. Pendente: ${currency(stats.pending)}.`;
}

function prepareCanvas(id) {
  const canvas = document.getElementById(id);
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, rect.width * ratio);
  canvas.height = Math.max(1, (Number(canvas.getAttribute("height")) || rect.height || 220) * ratio);
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  return { canvas, ctx, width: rect.width, height: Number(canvas.getAttribute("height")) || 220 };
}

function drawRing(id, percent) {
  const canvas = document.getElementById(id);
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const center = size / 2;
  const radius = size / 2 - 12;
  ctx.clearRect(0, 0, size, size);
  ctx.lineWidth = 14;
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue(getBudgetColor(percent).replace("var(", "").replace(")", "")) || "#1f9d68";
  ctx.beginPath();
  ctx.arc(center, center, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(percent, 100) / 100);
  ctx.stroke();
}

function drawBarChart(id, entries, color) {
  const { ctx, width, height } = prepareCanvas(id);
  ctx.clearRect(0, 0, width, height);
  if (!entries.length) return drawEmpty(ctx, width, height);
  const max = Math.max(...entries.map(([, value]) => value), 1);
  const barHeight = Math.max(18, Math.min(28, (height - 30) / entries.length - 8));
  ctx.font = "12px Inter, sans-serif";
  entries.forEach(([label, value], index) => {
    const y = 18 + index * (barHeight + 10);
    const barWidth = (width - 118) * (value / max);
    ctx.fillStyle = "#667085";
    ctx.fillText(label.slice(0, 14), 0, y + 14);
    ctx.fillStyle = "#e1e8ef";
    ctx.fillRect(96, y, width - 106, barHeight);
    ctx.fillStyle = color;
    ctx.fillRect(96, y, Math.max(4, barWidth), barHeight);
    ctx.fillStyle = "#182033";
    ctx.fillText(currency(value).replace("R$", "").trim(), 102, y + 14);
  });
}

function drawLineChart(id, entries) {
  const { ctx, width, height } = prepareCanvas(id);
  ctx.clearRect(0, 0, width, height);
  if (!entries.length) return drawEmpty(ctx, width, height);
  const padding = 24;
  const max = Math.max(...entries.map(([, value]) => value), 1);
  ctx.strokeStyle = "#dbe2ea";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();
  ctx.strokeStyle = "#2462a7";
  ctx.lineWidth = 3;
  ctx.beginPath();
  entries.forEach(([, value], index) => {
    const x = padding + (index / Math.max(1, entries.length - 1)) * (width - padding * 2);
    const y = height - padding - (value / max) * (height - padding * 2);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function drawEmpty(ctx, width, height) {
  ctx.fillStyle = "#667085";
  ctx.font = "14px Inter, sans-serif";
  ctx.fillText("Nenhum gasto registrado.", 12, height / 2);
}

function weekTotals(expenses) {
  const { start, endExclusive } = getCycleBounds();
  const cycleDays = Math.round((endExclusive - start) / 86400000);
  const totals = Array.from({ length: Math.ceil(cycleDays / 7) }, (_, index) => [`Semana ${index + 1}`, 0]);
  expenses.forEach((expense) => {
    const expenseDate = parseLocalDate(expense.data_emissao);
    if (!expenseDate) return;
    const week = Math.min(totals.length - 1, Math.floor((expenseDate - start) / 86400000 / 7));
    totals[week][1] += Number(expense.valor_total || 0);
  });
  return totals;
}

function dailyTotals(expenses) {
  const { start, endExclusive } = getCycleBounds();
  const cycleDays = Math.round((endExclusive - start) / 86400000);
  let running = 0;
  return Array.from({ length: cycleDays }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const key = localDateKey(date);
    running += sum(expenses.filter((expense) => expense.data_emissao === key), (expense) => expense.valor_total);
    return [String(date.getDate()), running];
  });
}

function populateSelects() {
  document.querySelectorAll('select[name="categoria"]').forEach((select) => {
    const includeAll = select.closest("#filterForm");
    select.innerHTML = `${includeAll ? '<option value="">Todas</option>' : ""}${categories.map((category) => `<option>${category}</option>`).join("")}`;
  });
  document.querySelectorAll('select[name="forma_pagamento"]').forEach((select) => {
    const includeAll = select.closest("#filterForm");
    select.innerHTML = `${includeAll ? '<option value="">Todas</option>' : ""}${paymentMethods.map((method) => `<option>${method}</option>`).join("")}`;
  });
}

function setView(view) {
  document.querySelectorAll(".view").forEach((element) => element.classList.toggle("is-active", element.id === `${view}View`));
  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (view === "home") window.requestAnimationFrame(() => drawCharts(getStats()));
}

function getWebhookUrl(showMessage = true) {
  const configured = window.N8N_UPLOAD_WEBHOOK_URL || document.querySelector('meta[name="N8N_UPLOAD_WEBHOOK_URL"]')?.content || localStorage.getItem("N8N_UPLOAD_WEBHOOK_URL") || state.settings.webhookUrl || "";
  if (!configured && showMessage) {
    dom.uploadMessage.textContent = "Configure a URL do webhook n8n em Perfil antes de enviar.";
    return "";
  }
  if (configured && !isValidWebhookUrl(configured)) {
    if (showMessage) dom.uploadMessage.textContent = "Use uma URL HTTPS válida para o webhook n8n.";
    return "";
  }
  return configured;
}

function isValidWebhookUrl(value) {
  try {
    const url = new URL(String(value).trim());
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function createExpenseFromForm(form, origin) {
  const data = Object.fromEntries(new FormData(form).entries());
  const total = Number(data.valor_total || 0);
  return normalizeExpense({
    ...data,
    fornecedor: data.fornecedor || "",
    data_registro: new Date().toISOString().slice(0, 10),
    valor_produtos: Number(data.valor_produtos || total),
    valor_frete: Number(data.valor_frete || 0),
    valor_desconto: Number(data.valor_desconto || 0),
    valor_total: total,
    origem: origin,
    confianca_leitura: Number(data.confianca_leitura || 1),
  });
}

function normalizeExpense(data) {
  const source = data && typeof data === "object" ? data : {};
  const total = Math.max(0, parseMoney(pickValue(source, ["valor_total", "valorTotal", "total", "valor", "valor_compra", "valor_gasto", "amount"])));
  const products = Math.max(0, parseMoney(pickValue(source, ["valor_produtos", "valorProdutos", "subtotal", "valor_itens", "valor_dos_produtos"]))) || total;
  const shipping = Math.max(0, parseMoney(pickValue(source, ["valor_frete", "valorFrete", "frete"])));
  const discount = Math.max(0, parseMoney(pickValue(source, ["valor_desconto", "valorDesconto", "desconto"])));
  const supplier = safeText(pickValue(source, ["fornecedor", "estabelecimento", "nome_estabelecimento", "nomeEstabelecimento", "loja", "empresa", "merchant"]), 160);
  const description = safeText(pickValue(source, ["descricao", "descricao_gasto", "descricaoGasto", "resumo", "itens_resumo", "nome_compra"]), 240);
  const issueDate = normalizeDate(pickValue(source, ["data_emissao", "dataEmissao", "data_compra", "dataCompra", "data", "emissao"]));
  const dueDate = normalizeDate(pickValue(source, ["data_vencimento", "dataVencimento", "vencimento"]));
  const confidence = parseConfidence(pickValue(source, ["confianca_leitura", "confiancaLeitura", "confianca", "confidence", "score"]));
  const itemsSource = pickValue(source, ["itens_json", "itens", "itens_comprados", "items", "produtos"]);
  const parsedItems = Array.isArray(itemsSource) ? itemsSource : parseJson(itemsSource, []);
  const items = Array.isArray(parsedItems)
    ? parsedItems.slice(0, 50).map((item) => ({
      nome: safeText(item?.nome || item?.descricao || item?.produto || item?.name || "Item", 160),
      valor: Math.max(0, parseMoney(item?.valor || item?.preco || item?.price)),
    }))
    : [];
  const sourceId = safeText(source.id, 80);
  const hasSafeSourceId = /^[a-zA-Z0-9_-]{1,80}$/.test(sourceId);
  const registrationDate = normalizeDate(pickValue(source, ["data_registro", "dataRegistro"])) || localDateKey(todayLocal());
  const origin = normalizeOrigin(source.origem);

  return {
    id: hasSafeSourceId ? sourceId : crypto.randomUUID(),
    data_registro: registrationDate,
    fornecedor: supplier || "",
    cnpj_fornecedor: safeText(pickValue(source, ["cnpj_fornecedor", "cnpjFornecedor", "cnpj", "cnpj_estabelecimento"]), 32),
    numero_nota: safeText(pickValue(source, ["numero_nota", "numeroNota", "numero_da_nota", "numero", "nf", "nota_fiscal", "chave_acesso"]), 80),
    data_emissao: issueDate || new Date().toISOString().slice(0, 10),
    data_vencimento: dueDate || "",
    status_vencimento: safeText(pickValue(source, ["status_vencimento", "statusVencimento"]), 40),
    categoria: normalizeCategory(pickValue(source, ["categoria", "category"])) || "Outros",
    descricao: description || supplier || "Gasto",
    forma_pagamento: normalizePaymentMethod(pickValue(source, ["forma_pagamento", "formaPagamento", "pagamento", "meio_pagamento"])) || "Pix",
    valor_produtos: products,
    valor_frete: shipping,
    valor_desconto: discount,
    valor_total: total,
    status_pagamento: normalizePaymentStatus(pickValue(source, ["status_pagamento", "statusPagamento", "status", "situacao"])) || "Pendente",
    itens_json: items,
    dica_financeira: safeText(pickValue(source, ["dica_financeira", "dicaFinanceira", "dica"]), 500),
    alerta_financeiro: safeText(pickValue(source, ["alerta_financeiro", "alertaFinanceiro", "alerta"]), 500),
    confianca_leitura: confidence,
    observacoes: safeText(pickValue(source, ["observacoes", "observacao", "obs"]), 1000),
    itens_resumo: safeText(pickValue(source, ["itens_resumo", "itensResumo", "resumo_itens"]), 1000) || summarizeItems(items),
    qtd_itens: Math.max(0, Math.min(999, Number(pickValue(source, ["qtd_itens", "qtdItens", "quantidade_itens"]) || items.length))),
    origem: origin,
    updated_at: normalizeTimestamp(source.updated_at || source.updatedAt) || (hasSafeSourceId ? `${registrationDate}T00:00:00.000Z` : new Date().toISOString()),
  };
}

function safeText(value, maxLength = 500) {
  return String(value ?? "").replace(/\0/g, "").trim().slice(0, maxLength);
}

function normalizeTimestamp(value) {
  const parsed = new Date(String(value || ""));
  return Number.isNaN(parsed.valueOf()) ? "" : parsed.toISOString();
}

function normalizeDeletedExpenses(value) {
  if (!Array.isArray(value)) return [];
  const latestById = new Map();
  value.slice(0, 5000).forEach((item) => {
    const id = safeText(item?.id, 80);
    const deletedAt = normalizeTimestamp(item?.deleted_at || item?.deletedAt);
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || !deletedAt) return;
    const current = latestById.get(id);
    if (!current || deletedAt > current.deleted_at) latestById.set(id, { id, deleted_at: deletedAt });
  });
  return [...latestById.values()];
}

function normalizeOrigin(value) {
  const normalized = normalizeKey(value);
  if (normalized === "notafiscal") return "Nota fiscal";
  if (normalized === "registromanual") return "Registro manual";
  return "Comprovante";
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function extractExpensePayload(payload) {
  const parsed = parsePayloadValue(payload);
  const candidates = flattenPayload(parsed);
  const best = candidates
    .filter((candidate) => candidate && typeof candidate === "object" && !Array.isArray(candidate))
    .map((candidate) => ({ candidate, score: scoreExpenseCandidate(candidate) }))
    .sort((a, b) => b.score - a.score)[0];

  return best && best.score > 0 ? best.candidate : {};
}

function parsePayloadValue(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const jsonText = withoutFence.match(/[\[{][\s\S]*[\]}]/)?.[0] || withoutFence;
  try {
    return JSON.parse(jsonText);
  } catch {
    return value;
  }
}

function flattenPayload(value, depth = 0) {
  if (value == null || depth > 5) return [];
  const parsed = parsePayloadValue(value);
  if (Array.isArray(parsed)) return parsed.flatMap((item) => flattenPayload(item, depth + 1));
  if (typeof parsed !== "object") return [];

  const candidates = [parsed];
  [
    "gasto",
    "expense",
    "data",
    "body",
    "json",
    "result",
    "resultado",
    "response",
    "resposta",
    "output",
    "text",
    "message",
  ].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(parsed, key)) {
      candidates.push(...flattenPayload(parsed[key], depth + 1));
    }
  });
  return candidates;
}

function scoreExpenseCandidate(candidate) {
  const fieldGroups = [
    ["fornecedor", "estabelecimento", "nome_estabelecimento", "loja"],
    ["cnpj_fornecedor", "cnpj"],
    ["numero_nota", "numeroNota", "numero_da_nota", "nf"],
    ["data_emissao", "data_compra", "data"],
    ["categoria"],
    ["descricao", "descricao_gasto"],
    ["forma_pagamento", "pagamento"],
    ["valor_total", "total", "valor", "valor_compra"],
    ["status_pagamento", "status"],
    ["itens_json", "itens", "items", "produtos"],
  ];
  return fieldGroups.reduce((score, group) => score + (pickValue(candidate, group) !== "" ? 1 : 0), 0);
}

function pickValue(source, keys) {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== "") return source[key];
  }
  const normalizedMap = Object.keys(source).reduce((acc, key) => {
    acc[normalizeKey(key)] = source[key];
    return acc;
  }, {});
  for (const key of keys) {
    const normalized = normalizeKey(key);
    if (normalizedMap[normalized] !== undefined && normalizedMap[normalized] !== null && normalizedMap[normalized] !== "") {
      return normalizedMap[normalized];
    }
  }
  return "";
}

function normalizeKey(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function parseMoney(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const cleaned = String(value).replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDate(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return localDateKey(value);
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return isValidDateParts(iso[1], iso[2], iso[3]) ? `${iso[1]}-${iso[2]}-${iso[3]}` : "";
  const br = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    const month = br[2].padStart(2, "0");
    const day = br[1].padStart(2, "0");
    return isValidDateParts(year, month, day) ? `${year}-${month}-${day}` : "";
  }
  return "";
}

function isValidDateParts(year, month, day) {
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return parsed.getFullYear() === Number(year) && parsed.getMonth() === Number(month) - 1 && parsed.getDate() === Number(day);
}

function normalizeCategory(value) {
  if (!value) return "";
  const normalized = normalizeKey(value);
  return categories.find((category) => normalizeKey(category) === normalized) || "Outros";
}

function normalizePaymentMethod(value) {
  if (!value) return "";
  const normalized = normalizeKey(value);
  return paymentMethods.find((method) => normalizeKey(method) === normalized) || "";
}

function normalizePaymentStatus(value) {
  if (!value) return "";
  const normalized = normalizeKey(value);
  if (["pago", "paga", "quitado", "quitada", "paid"].includes(normalized)) return "Pago";
  if (["pendente", "aberto", "emaberto", "vencido", "vencida", "pending"].includes(normalized)) return "Pendente";
  return "";
}

function parseConfidence(value) {
  if (value === "" || value === null || value === undefined) return 0.8;
  const parsed = parseMoney(value);
  if (!parsed) return 0;
  return parsed > 1 ? Math.min(parsed / 100, 1) : Math.min(parsed, 1);
}

function summarizeItems(items) {
  if (!Array.isArray(items)) return "";
  return items
    .map((item) => item?.nome || item?.descricao || item?.produto || item?.name)
    .filter(Boolean)
    .slice(0, 6)
    .join(", ");
}

async function sendReceipt() {
  if (!selectedFile) return;
  const webhookUrl = getWebhookUrl(true);
  if (!webhookUrl) return;
  if (!validateFile(selectedFile)) return;

  setProcessing(true);
  const formData = new FormData();
  formData.append("Nota Fiscal", selectedFile, selectedFile.name);
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 20000);

  try {
    await animateProcessing();
    const response = await fetch(webhookUrl, { method: "POST", body: formData, signal: controller.signal });
    if (!response.ok) throw new Error("Erro no envio.");
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > 200000) throw new Error("Resposta muito grande.");
    const responseText = await response.text();
    if (responseText.length > 200000) throw new Error("Resposta muito grande.");
    const payload = parsePayloadValue(responseText);
    const extractedPayload = extractExpensePayload(payload);
    const identified = normalizeExpense(extractedPayload);
    if (!scoreExpenseCandidate(extractedPayload)) {
      identified.confianca_leitura = 0.45;
      identified.alerta_financeiro = "O n8n respondeu, mas o app não reconheceu os campos retornados.";
    }
    pendingReview = identified;
    openReview(identified);
    dom.uploadMessage.textContent = Number(identified.confianca_leitura) < 0.75
      ? "Comprovante recebido. Alguns campos precisam de revisão."
      : "Comprovante lido. Revise os dados antes de confirmar.";
  } catch (error) {
    const fallback = normalizeExpense({
      fornecedor: "Compra identificada",
      descricao: selectedFile.name.replace(/\.[^.]+$/, ""),
      categoria: "Outros",
      valor_total: 0,
      status_pagamento: "Pendente",
      confianca_leitura: 0.62,
      alerta_financeiro: "Erro na leitura. Revise os dados manualmente.",
      origem: "Comprovante",
    });
    pendingReview = fallback;
    openReview(fallback);
    dom.uploadMessage.textContent = error?.name === "AbortError"
      ? "A leitura demorou mais de 20 segundos. Revise e salve os dados manualmente."
      : "Falha de conexão ou leitura. Você pode revisar e salvar manualmente.";
  } finally {
    window.clearTimeout(timeoutId);
    setProcessing(false);
  }
}

function validateFile(file) {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    dom.uploadMessage.textContent = "Formato inválido. Use JPG, JPEG, PNG ou WEBP.";
    return false;
  }
  if (file.size > 8 * 1024 * 1024) {
    dom.uploadMessage.textContent = "Imagem muito grande. Envie um arquivo de até 8 MB.";
    return false;
  }
  return true;
}

function setProcessing(isProcessing) {
  dom.sendReceipt.disabled = isProcessing || !selectedFile;
  dom.removeImage.disabled = isProcessing || !selectedFile;
  dom.receiptInput.disabled = isProcessing;
}

function animateProcessing() {
  dom.processingSteps.innerHTML = processingLabels.map((label) => `<li>${label}</li>`).join("");
  const items = [...dom.processingSteps.querySelectorAll("li")];
  let promise = Promise.resolve();
  items.forEach((item, index) => {
    promise = promise.then(() => new Promise((resolve) => {
      items.forEach((step) => step.classList.remove("is-active"));
      item.classList.add("is-active");
      setTimeout(() => {
        item.classList.remove("is-active");
        item.classList.add("is-done");
        resolve();
      }, index === 0 ? 350 : 260);
    }));
  });
  return promise;
}

function openReview(expense, mode = "create") {
  reviewMode = mode;
  pendingReview = normalizeExpense(expense);
  dom.reviewEyebrow.textContent = mode === "edit" ? "Edição" : "Revisão";
  dom.reviewTitle.textContent = mode === "edit" ? "Editar gasto" : "Revisar gasto identificado";
  dom.confirmReview.textContent = mode === "edit" ? "Salvar alterações" : "Confirmar gasto";
  dom.confidenceWarning.classList.toggle("is-hidden", Number(expense.confianca_leitura) >= 0.75);
  const fields = [
    ["fornecedor", "Nome do estabelecimento", "text"],
    ["cnpj_fornecedor", "CNPJ", "text"],
    ["numero_nota", "Número da nota", "text"],
    ["data_emissao", "Data da compra", "date"],
    ["data_vencimento", "Data de vencimento", "date"],
    ["categoria", "Categoria", "select"],
    ["descricao", "Descrição", "text"],
    ["forma_pagamento", "Forma de pagamento", "select-payment"],
    ["valor_produtos", "Valor dos produtos", "number"],
    ["valor_frete", "Valor do frete", "number"],
    ["valor_desconto", "Valor do desconto", "number"],
    ["valor_total", "Valor total", "number"],
    ["status_pagamento", "Status do pagamento", "select-status"],
    ["itens_resumo", "Itens comprados", "textarea"],
    ["observacoes", "Observações", "textarea"],
  ];
  dom.reviewForm.replaceChildren(...fields.map(([name, label, type]) => createReviewField(name, label, type, pendingReview[name])));
  openOverlay(dom.reviewModal, "input,select,textarea");
}

function createReviewField(name, labelText, type, value) {
  const label = document.createElement("label");
  label.className = `field ${type === "textarea" ? "field-full" : ""}`.trim();
  const text = document.createElement("span");
  text.textContent = labelText;
  label.append(text);

  let control;
  if (["select", "select-payment", "select-status"].includes(type)) {
    control = document.createElement("select");
    const values = type === "select" ? categories : type === "select-payment" ? paymentMethods : ["Pago", "Pendente"];
    values.forEach((optionValue) => {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = optionValue;
      control.append(option);
    });
  } else if (type === "textarea") {
    control = document.createElement("textarea");
    control.rows = 3;
    control.maxLength = name === "observacoes" ? 1000 : 1000;
  } else {
    control = document.createElement("input");
    control.type = type;
    if (type === "number") {
      control.min = "0";
      control.step = "0.01";
    } else if (type === "text") {
      control.maxLength = name === "descricao" ? 240 : 160;
    }
  }
  control.name = name;
  control.value = value ?? "";
  control.required = ["data_emissao", "categoria", "descricao", "forma_pagamento", "valor_total", "status_pagamento"].includes(name);
  label.append(control);
  return label;
}

function confirmReview() {
  if (!dom.reviewForm.reportValidity()) return;
  const formData = Object.fromEntries(new FormData(dom.reviewForm).entries());
  const expense = normalizeExpense({ ...pendingReview, ...formData, updated_at: new Date().toISOString() });
  if (reviewMode === "create") prepareForRealData();
  state.expenses = [expense, ...state.expenses.filter((item) => item.id !== expense.id)];
  state.deletedExpenses = state.deletedExpenses.filter((item) => item.id !== expense.id);
  markCloudChange();
  const wasEditing = reviewMode === "edit";
  closeReview();
  if (!wasEditing) clearSelectedImage();
  selectedMonth = cycleAnchorForDate(expense.data_emissao);
  render();
  if (wasEditing) {
    setView("expenses");
    openDetail(expense.id);
    showToast("Alterações salvas e prontas para sincronizar.");
  } else {
    setView("home");
    showToast("Gasto salvo e pronto para sincronizar.");
  }
}

function closeReview() {
  pendingReview = null;
  reviewMode = "create";
  closeOverlay(dom.reviewModal);
}

function clearSelectedImage() {
  selectedFile = null;
  dom.receiptInput.value = "";
  dom.receiptPreview.src = "";
  dom.receiptPreview.classList.add("is-hidden");
  dom.emptyUploadState.classList.remove("is-hidden");
  dom.removeImage.disabled = true;
  dom.sendReceipt.disabled = true;
  dom.processingSteps.innerHTML = "";
}

function openDetail(id) {
  selectedExpenseId = id;
  const expense = state.expenses.find((item) => item.id === id);
  if (!expense) return;
  dom.detailTitle.textContent = expense.fornecedor || expense.descricao;
  const items = [
    ["Estabelecimento", expense.fornecedor || "-"],
    ["CNPJ", expense.cnpj_fornecedor || "-"],
    ["Número da nota", expense.numero_nota || "-"],
    ["Data da compra", dateBR(expense.data_emissao)],
    ["Data do registro", dateBR(expense.data_registro)],
    ["Data de vencimento", dateBR(expense.data_vencimento)],
    ["Categoria", expense.categoria],
    ["Descrição", expense.descricao],
    ["Forma de pagamento", expense.forma_pagamento],
    ["Valor dos produtos", currency(expense.valor_produtos)],
    ["Frete", currency(expense.valor_frete)],
    ["Desconto", currency(expense.valor_desconto)],
    ["Valor total", currency(expense.valor_total)],
    ["Status", expense.status_pagamento],
    ["Itens comprados", expense.itens_resumo || (expense.itens_json || []).map((item) => item.nome).join(", ") || "-"],
    ["Dica financeira", expense.dica_financeira || "-"],
    ["Alerta financeiro", expense.alerta_financeiro || "-"],
    ["Confiança da leitura", `${Math.round(Number(expense.confianca_leitura || 0) * 100)}%`],
    ["Observações", expense.observacoes || "-"],
  ];
  dom.detailContent.innerHTML = items.map(([label, value]) => `<div class="detail-item"><span>${label}</span><strong>${sanitizeText(value)}</strong></div>`).join("");
  dom.markPaid.classList.toggle("is-hidden", expense.status_pagamento === "Pago");
  dom.markPending.classList.toggle("is-hidden", expense.status_pagamento === "Pendente");
  openOverlay(dom.detailModal, "#editExpense");
}

function closeDetailModal() {
  closeOverlay(dom.detailModal);
}

function editSelectedExpense() {
  const expense = state.expenses.find((item) => item.id === selectedExpenseId);
  if (!expense) return;
  closeDetailModal();
  openReview(expense, "edit");
}

function updateSelectedStatus(status) {
  const expense = state.expenses.find((item) => item.id === selectedExpenseId);
  if (!expense) return;
  expense.status_pagamento = status;
  expense.updated_at = new Date().toISOString();
  markCloudChange();
  render();
  openDetail(expense.id);
  showToast(`Gasto marcado como ${status.toLowerCase()}.`);
}

async function shareSelectedExpense() {
  const expense = state.expenses.find((item) => item.id === selectedExpenseId);
  if (!expense) return;
  const text = `${expense.fornecedor || expense.descricao} - ${dateBR(expense.data_emissao)} - ${currency(expense.valor_total)} - ${expense.status_pagamento}`;
  try {
    if (navigator.share) await navigator.share({ title: "Resumo do gasto", text });
    else {
      await navigator.clipboard?.writeText(text);
      showToast("Resumo copiado.");
    }
  } catch (error) {
    if (error?.name !== "AbortError") showToast("Não foi possível compartilhar o resumo.");
  }
}

function deleteSelectedExpense() {
  const expense = state.expenses.find((item) => item.id === selectedExpenseId);
  if (!expense) return;
  if (!confirm(`Excluir o gasto "${expense.fornecedor || expense.descricao}"?`)) return;
  const index = state.expenses.findIndex((item) => item.id === selectedExpenseId);
  lastDeletedExpense = { expense: structuredClone(expense), index };
  state.deletedExpenses = normalizeDeletedExpenses([...state.deletedExpenses, { id: expense.id, deleted_at: new Date().toISOString() }]);
  state.expenses = state.expenses.filter((item) => item.id !== selectedExpenseId);
  markCloudChange();
  selectedExpenseId = null;
  closeDetailModal();
  render();
  showToast("Gasto excluído.", "Desfazer");
}

function undoDelete() {
  if (!lastDeletedExpense) return;
  const { expense, index } = lastDeletedExpense;
  expense.updated_at = new Date().toISOString();
  state.expenses.splice(Math.max(0, index), 0, expense);
  state.deletedExpenses = state.deletedExpenses.filter((item) => item.id !== expense.id);
  lastDeletedExpense = null;
  markCloudChange();
  render();
  showToast("Gasto restaurado.");
}

function prepareForRealData() {
  if (!state.demoMode) return;
  state.expenses = state.expenses.filter((expense) => !String(expense.id).startsWith("sample-"));
  state.demoMode = false;
}

function clearDemoData() {
  prepareForRealData();
  selectedMonth = cycleAnchorForDate(localDateKey(todayLocal()));
  markCloudChange();
  render();
  showToast("Dados de demonstração removidos. Agora você pode registrar seus gastos.");
}

function showToast(message, actionLabel = "") {
  window.clearTimeout(toastTimer);
  dom.toastMessage.textContent = message;
  dom.toastAction.textContent = actionLabel;
  dom.toastAction.classList.toggle("is-hidden", !actionLabel);
  dom.toastRegion.classList.remove("is-hidden");
  toastTimer = window.setTimeout(() => {
    dom.toastRegion.classList.add("is-hidden");
    if (actionLabel === "Desfazer") lastDeletedExpense = null;
  }, 7000);
}

function openOverlay(element, focusSelector) {
  lastFocusedElement = document.activeElement;
  element.classList.remove("is-hidden");
  element.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-overlay");
  window.setTimeout(() => element.querySelector(focusSelector || "button,input,select,textarea")?.focus(), 0);
}

function closeOverlay(element) {
  element.classList.add("is-hidden");
  element.setAttribute("aria-hidden", "true");
  if (![dom.reviewModal, dom.detailModal, dom.filterDrawer].some((overlay) => !overlay.classList.contains("is-hidden"))) {
    document.body.classList.remove("has-overlay");
  }
  if (lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus();
}

function handleOverlayKeydown(event) {
  const overlay = [dom.reviewModal, dom.detailModal, dom.filterDrawer].find((item) => !item.classList.contains("is-hidden"));
  if (!overlay) return;
  if (event.key === "Escape") {
    if (overlay === dom.reviewModal) closeReview();
    else if (overlay === dom.detailModal) closeDetailModal();
    else closeOverlay(dom.filterDrawer);
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = [...overlay.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.classList.contains("is-hidden"));
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function bindEvents() {
  dom.authButton.addEventListener("click", authenticate);
  dom.pinInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") authenticate();
  });
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  document.querySelectorAll("[data-view-target]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.viewTarget)));
  dom.prevMonth.addEventListener("click", () => {
    selectedMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1);
    render();
  });
  dom.nextMonth.addEventListener("click", () => {
    selectedMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1);
    render();
  });
  dom.refreshDashboard.addEventListener("click", refreshDataNow);
  dom.refreshData.addEventListener("click", refreshDataNow);
  dom.syncNowTop.addEventListener("click", () => syncCloud({ manual: true }));
  dom.syncNow.addEventListener("click", () => syncCloud({ manual: true }));
  dom.exportBackup.addEventListener("click", exportFinancialBackup);
  dom.importBackup.addEventListener("change", importFinancialBackup);
  dom.lockApp.addEventListener("click", lockApp);
  dom.clearDemoData.addEventListener("click", clearDemoData);
  dom.searchInput.addEventListener("input", renderExpenses);
  dom.showUpload.addEventListener("click", () => toggleAddMode("upload"));
  dom.showManual.addEventListener("click", () => toggleAddMode("manual"));
  dom.receiptInput.addEventListener("change", handleFileSelect);
  dom.removeImage.addEventListener("click", clearSelectedImage);
  dom.sendReceipt.addEventListener("click", sendReceipt);
  dom.manualForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const expense = createExpenseFromForm(dom.manualForm, "Registro manual");
    prepareForRealData();
    state.expenses.unshift(expense);
    state.deletedExpenses = state.deletedExpenses.filter((item) => item.id !== expense.id);
    markCloudChange();
    dom.manualForm.reset();
    dom.manualForm.data_emissao.value = localDateKey(todayLocal());
    dom.manualForm.status_pagamento.value = "Pago";
    selectedMonth = cycleAnchorForDate(expense.data_emissao);
    render();
    setView("home");
    showToast("Gasto salvo e pronto para sincronizar.");
  });
  dom.settingsForm.addEventListener("submit", saveSettings);
  dom.expensesList.addEventListener("click", (event) => {
    const card = event.target.closest("[data-expense-id]");
    if (card) openDetail(card.dataset.expenseId);
  });
  dom.closeReview.addEventListener("click", closeReview);
  dom.cancelReview.addEventListener("click", closeReview);
  dom.editReview.addEventListener("click", () => dom.reviewForm.querySelector("input,select,textarea")?.focus());
  dom.confirmReview.addEventListener("click", confirmReview);
  dom.closeDetail.addEventListener("click", closeDetailModal);
  dom.editExpense.addEventListener("click", editSelectedExpense);
  dom.markPaid.addEventListener("click", () => updateSelectedStatus("Pago"));
  dom.markPending.addEventListener("click", () => updateSelectedStatus("Pendente"));
  dom.shareExpense.addEventListener("click", shareSelectedExpense);
  dom.deleteExpense.addEventListener("click", deleteSelectedExpense);
  dom.openFilters.addEventListener("click", () => openOverlay(dom.filterDrawer, "select,input"));
  dom.closeFilters.addEventListener("click", () => closeOverlay(dom.filterDrawer));
  dom.clearFilters.addEventListener("click", () => {
    state.filters = structuredClone(defaultState.filters);
    dom.filterForm.reset();
    renderExpenses();
  });
  dom.filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.filters = { ...state.filters, ...Object.fromEntries(new FormData(dom.filterForm).entries()) };
    closeOverlay(dom.filterDrawer);
    renderExpenses();
  });
  [dom.homeAlerts, dom.alertsList].forEach((container) => container.addEventListener("click", handleAlertAction));
  dom.toastAction.addEventListener("click", undoDelete);
  [dom.reviewModal, dom.detailModal, dom.filterDrawer].forEach((overlay) => {
    overlay.addEventListener("click", (event) => {
      if (event.target !== overlay) return;
      if (overlay === dom.reviewModal) closeReview();
      else if (overlay === dom.detailModal) closeDetailModal();
      else closeOverlay(dom.filterDrawer);
    });
  });
  document.addEventListener("keydown", handleOverlayKeydown);
  window.addEventListener("online", () => syncCloud());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !dom.appShell.classList.contains("is-hidden")) syncCloud();
  });
  window.addEventListener("resize", () => drawCharts(getStats()));
}

function handleAlertAction(event) {
  const action = event.target.closest("[data-alert-expense-id],[data-alert-view]");
  if (!action) return;
  if (action.dataset.alertExpenseId) {
    setView("expenses");
    openDetail(action.dataset.alertExpenseId);
  } else if (action.dataset.alertView) {
    setView(action.dataset.alertView);
  }
}

async function authenticate() {
  const pin = dom.pinInput.value.trim();
  if (!/^\d{4,12}$/.test(pin)) {
    dom.authMessage.textContent = "Informe um PIN de 4 a 12 dígitos.";
    return;
  }
  dom.authButton.disabled = true;
  dom.authMessage.textContent = "Verificando...";
  try {
    const savedCredential = localStorage.getItem(pinHashKey);
    const legacyPin = localStorage.getItem(pinKey);
    if (savedCredential && !(await verifyPin(pin, savedCredential))) {
      dom.authMessage.textContent = "PIN incorreto.";
      return;
    }
    if (!savedCredential && legacyPin && legacyPin !== pin) {
      dom.authMessage.textContent = "PIN incorreto.";
      return;
    }
    if (!savedCredential) {
      localStorage.setItem(pinHashKey, await createPinCredential(pin));
      localStorage.removeItem(pinKey);
    }
    localStorage.setItem(authSessionKey, JSON.stringify({ unlockedAt: Date.now() }));
    unlockApp();
  } catch {
    dom.authMessage.textContent = "Não foi possível proteger o PIN neste navegador.";
  } finally {
    dom.authButton.disabled = false;
  }
}

function unlockApp() {
  dom.authScreen.classList.add("is-hidden");
  dom.appShell.classList.remove("is-hidden");
  dom.pinInput.value = "";
  dom.authMessage.textContent = "";
  render();
  initializeCloudSync();
}

function lockApp() {
  window.clearTimeout(cloudSyncTimer);
  window.clearInterval(cloudPollTimer);
  localStorage.removeItem(authSessionKey);
  dom.appShell.classList.add("is-hidden");
  dom.authScreen.classList.remove("is-hidden");
  dom.authMessage.textContent = "Aplicativo bloqueado. Informe seu PIN para entrar.";
  window.setTimeout(() => dom.pinInput.focus(), 0);
}

function hasActiveAuthSession() {
  if (!localStorage.getItem(pinHashKey) && !localStorage.getItem(pinKey)) return false;
  const savedSession = parseJson(localStorage.getItem(authSessionKey), null);
  if (!savedSession?.unlockedAt) return false;
  return Date.now() - Number(savedSession.unlockedAt) < authSessionDuration;
}

async function createPinCredential(pin) {
  const iterations = 120000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePin(pin, salt, iterations);
  return `pbkdf2$${iterations}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`;
}

async function verifyPin(pin, credential) {
  const [algorithm, iterationsText, saltText, hashText] = String(credential).split("$");
  const iterations = Number(iterationsText);
  if (algorithm !== "pbkdf2" || !Number.isInteger(iterations) || iterations < 100000 || !saltText || !hashText) return false;
  const actual = await derivePin(pin, base64ToBytes(saltText), iterations);
  const expected = base64ToBytes(hashText);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  actual.forEach((byte, index) => { difference |= byte ^ expected[index]; });
  return difference === 0;
}

async function derivePin(pin, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256);
  return new Uint8Array(bits);
}

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function toggleAddMode(mode) {
  const isUpload = mode === "upload";
  dom.showUpload.classList.toggle("is-active", isUpload);
  dom.showManual.classList.toggle("is-active", !isUpload);
  dom.uploadPanel.classList.toggle("is-hidden", !isUpload);
  dom.manualPanel.classList.toggle("is-hidden", isUpload);
}

function handleFileSelect(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  selectedFile = file;
  if (!validateFile(file)) {
    clearSelectedImage();
    return;
  }
  dom.receiptPreview.src = URL.createObjectURL(file);
  dom.receiptPreview.classList.remove("is-hidden");
  dom.emptyUploadState.classList.add("is-hidden");
  dom.removeImage.disabled = false;
  dom.sendReceipt.disabled = false;
  dom.uploadMessage.textContent = "";
}

function saveSettings(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(dom.settingsForm).entries());
  const webhookUrl = safeText(data.webhookUrl, 2000);
  dom.settingsForm.webhookUrl.setCustomValidity(webhookUrl && !isValidWebhookUrl(webhookUrl) ? "Use uma URL HTTPS válida." : "");
  if (!dom.settingsForm.reportValidity()) return;
  const categoryLimits = {};
  categories.forEach((category) => {
    const value = data[`limit_${category}`];
    if (value) categoryLimits[category] = Number(value);
  });
  state.settings = {
    monthlyLimit: Math.max(0, Number(data.monthlyLimit || 0)),
    cycleStartDay: Math.min(28, Math.max(1, Number(data.cycleStartDay || 1))),
    savingsGoal: Math.max(0, Number(data.savingsGoal || 0)),
    monthlyIncome: Math.max(0, Number(data.monthlyIncome || 0)),
    emergencyReserveCurrent: Math.max(0, Number(data.emergencyReserveCurrent || 0)),
    emergencyReserveGoal: Math.max(0, Number(data.emergencyReserveGoal || 0)),
    webhookUrl,
    categoryLimits,
  };
  if (webhookUrl) localStorage.setItem("N8N_UPLOAD_WEBHOOK_URL", webhookUrl);
  else localStorage.removeItem("N8N_UPLOAD_WEBHOOK_URL");
  selectedMonth = cycleAnchorForDate(localDateKey(todayLocal()));
  markCloudChange();
  render();
  showToast("Configurações salvas e prontas para sincronizar.");
}

function normalizeCategoryLimits(limits) {
  if (!limits || typeof limits !== "object") return {};
  return Object.entries(limits).reduce((result, [category, value]) => {
    const normalizedCategory = normalizeCategory(category);
    const normalizedValue = Math.max(0, Number(value || 0));
    if (normalizedValue) result[normalizedCategory] = normalizedValue;
    return result;
  }, {});
}

function initForms() {
  populateSelects();
  dom.manualForm.data_emissao.value = localDateKey(todayLocal());
  dom.manualForm.status_pagamento.value = "Pago";
  Object.entries(state.filters).forEach(([key, value]) => {
    if (dom.filterForm.elements[key]) dom.filterForm.elements[key].value = value;
  });
}

initForms();
bindEvents();

if (hasActiveAuthSession()) {
  unlockApp();
} else if (localStorage.getItem(pinHashKey) || localStorage.getItem(pinKey)) {
  dom.authMessage.textContent = "Informe seu PIN para entrar.";
}

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./service-worker.js").then((registration) => registration.update()).catch(() => null);
}
