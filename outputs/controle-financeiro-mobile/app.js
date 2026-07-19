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
let cloudDeletionInProgress = false;
let pendingStatementImport = [];

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
  accounts: [
    { id: "sample-account-bank", name: "Conta principal", type: "Conta corrente", openingBalance: 2200, includeNetWorth: true, updated_at: "2026-07-01T00:00:00.000Z" },
    { id: "sample-account-wallet", name: "Carteira", type: "Carteira", openingBalance: 180, includeNetWorth: true, updated_at: "2026-07-01T00:00:00.000Z" },
  ],
  incomes: [
    { id: "sample-income-1", description: "Renda mensal", amount: 3500, date: "2026-07-05", accountId: "sample-account-bank", recurrenceGroup: "", updated_at: "2026-07-05T00:00:00.000Z" },
  ],
  transfers: [],
  cards: [
    { id: "sample-card-1", name: "Cartão principal", accountId: "sample-account-bank", limit: 2500, closingDay: 20, dueDay: 28, updated_at: "2026-07-01T00:00:00.000Z" },
  ],
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

function createEmptyState(localWebhookUrl = "") {
  return {
    settings: {
      monthlyLimit: 0,
      cycleStartDay: 1,
      savingsGoal: 0,
      monthlyIncome: 0,
      emergencyReserveCurrent: 0,
      emergencyReserveGoal: 0,
      webhookUrl: safeText(localWebhookUrl, 2048),
      categoryLimits: {},
    },
    accounts: [],
    incomes: [],
    transfers: [],
    cards: [],
    expenses: [],
    deletedExpenses: [],
    demoMode: false,
    filters: structuredClone(defaultState.filters),
  };
}

function isDemoRecord(record) {
  return String(record?.id || "").startsWith("sample-");
}

function stripDemoFinancialState(source) {
  const normalized = normalizeFinancialState(source);
  const demoCollections = [normalized.accounts, normalized.incomes, normalized.transfers, normalized.cards, normalized.expenses];
  const demoRecordCount = demoCollections.reduce((total, records) => total + records.filter(isDemoRecord).length, 0);
  const demoSettings = {
    monthlyLimit: 2200,
    savingsGoal: 300,
    monthlyIncome: 3500,
    emergencyReserveCurrent: 1500,
    emergencyReserveGoal: 9000,
  };
  const matchingDemoSettings = Object.entries(demoSettings)
    .filter(([key, value]) => Number(normalized.settings[key]) === value)
    .length;
  const hasDemoSignature = normalized.demoMode || demoRecordCount > 0 || matchingDemoSettings >= 4;
  const settings = {
    ...normalized.settings,
    categoryLimits: { ...(normalized.settings.categoryLimits || {}) },
  };

  if (hasDemoSignature) {
    for (const [key, value] of Object.entries(demoSettings)) {
      if (Number(settings[key]) === value) settings[key] = 0;
    }
    for (const [category, value] of Object.entries(defaultState.settings.categoryLimits)) {
      if (Number(settings.categoryLimits[category]) === value) delete settings.categoryLimits[category];
    }
  }

  const removedAccountIds = new Set(normalized.accounts.filter(isDemoRecord).map((record) => record.id));
  const removedCardIds = new Set(normalized.cards.filter(isDemoRecord).map((record) => record.id));
  return {
    settings,
    accounts: normalized.accounts.filter((record) => !isDemoRecord(record)),
    incomes: normalized.incomes
      .filter((record) => !isDemoRecord(record))
      .map((record) => removedAccountIds.has(record.accountId) ? { ...record, accountId: "" } : record),
    transfers: normalized.transfers.filter((record) => !isDemoRecord(record)),
    cards: normalized.cards
      .filter((record) => !isDemoRecord(record))
      .map((record) => removedAccountIds.has(record.accountId) ? { ...record, accountId: "" } : record),
    expenses: normalized.expenses
      .filter((record) => !isDemoRecord(record))
      .map((record) => ({
        ...record,
        account_id: removedAccountIds.has(record.account_id) ? "" : record.account_id,
        card_id: removedCardIds.has(record.card_id) ? "" : record.card_id,
      })),
    deletedExpenses: normalized.deletedExpenses.filter((record) => !isDemoRecord(record)),
    demoMode: false,
  };
}

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
  forecastConfidence: document.querySelector("#forecastConfidence"),
  forecastMetrics: document.querySelector("#forecastMetrics"),
  forecastRange: document.querySelector("#forecastRange"),
  forecastRangeBar: document.querySelector("#forecastRangeBar"),
  forecastExplanation: document.querySelector("#forecastExplanation"),
  forecastHorizons: document.querySelector("#forecastHorizons"),
  paceAdjustment: document.querySelector("#paceAdjustment"),
  paceAdjustmentLabel: document.querySelector("#paceAdjustmentLabel"),
  incomeAdjustment: document.querySelector("#incomeAdjustment"),
  scenarioResult: document.querySelector("#scenarioResult"),
  anomalyList: document.querySelector("#anomalyList"),
  subscriptionList: document.querySelector("#subscriptionList"),
  classificationBadge: document.querySelector("#classificationBadge"),
  classificationList: document.querySelector("#classificationList"),
  reconciliationBadge: document.querySelector("#reconciliationBadge"),
  financeMetrics: document.querySelector("#financeMetrics"),
  accountForm: document.querySelector("#accountForm"),
  accountsList: document.querySelector("#accountsList"),
  incomeForm: document.querySelector("#incomeForm"),
  incomeList: document.querySelector("#incomeList"),
  transferForm: document.querySelector("#transferForm"),
  transferList: document.querySelector("#transferList"),
  cardForm: document.querySelector("#cardForm"),
  cardsList: document.querySelector("#cardsList"),
  cashflowSummary: document.querySelector("#cashflowSummary"),
  netWorthSummary: document.querySelector("#netWorthSummary"),
  cashflowTimeline: document.querySelector("#cashflowTimeline"),
  importAccount: document.querySelector("#importAccount"),
  statementFile: document.querySelector("#statementFile"),
  importPreview: document.querySelector("#importPreview"),
  confirmImport: document.querySelector("#confirmImport"),
  importMessage: document.querySelector("#importMessage"),
  serviceHealth: document.querySelector("#serviceHealth"),
  refreshOperations: document.querySelector("#refreshOperations"),
  removeDemoData: document.querySelector("#removeDemoData"),
  eraseCloudData: document.querySelector("#eraseCloudData"),
  historyList: document.querySelector("#historyList"),
  auditList: document.querySelector("#auditList"),
  securityMessage: document.querySelector("#securityMessage"),
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
    const accounts = normalizeRecords(parsed.accounts, normalizeAccount, base.accounts);
    const incomes = normalizeRecords(parsed.incomes, normalizeIncome, base.incomes);
    const transfers = normalizeRecords(parsed.transfers, normalizeTransfer, base.transfers);
    const cards = normalizeRecords(parsed.cards, normalizeCard, base.cards);
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
      accounts,
      incomes,
      transfers,
      cards,
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
    accounts: normalized.accounts,
    incomes: normalized.incomes,
    transfers: normalized.transfers,
    cards: normalized.cards,
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
  const accounts = normalizeRecords(input.accounts, normalizeAccount, []);
  const incomes = normalizeRecords(input.incomes, normalizeIncome, []);
  const transfers = normalizeRecords(input.transfers, normalizeTransfer, []);
  const cards = normalizeRecords(input.cards, normalizeCard, []);
  const demoMode = Boolean(input.demoMode) && uniqueExpenses.every((expense) => String(expense.id).startsWith("sample-"));
  return { settings, accounts, incomes, transfers, cards, expenses: uniqueExpenses, deletedExpenses, demoMode };
}

function normalizeRecords(records, normalizer, fallback = []) {
  const input = Array.isArray(records) ? records : fallback;
  return [...input.slice(0, 5000).reduce((map, record) => {
    const normalized = normalizer(record);
    if (!normalized) return map;
    const current = map.get(normalized.id);
    if (!current || normalized.updated_at >= current.updated_at) map.set(normalized.id, normalized);
    return map;
  }, new Map()).values()];
}

function safeRecordId(value) {
  const id = safeText(value, 80);
  return /^[a-zA-Z0-9_-]{1,80}$/.test(id) ? id : crypto.randomUUID();
}

function normalizeAccount(record) {
  if (!record || typeof record !== "object") return null;
  return {
    id: safeRecordId(record.id),
    name: safeText(record.name, 80) || "Conta",
    type: ["Conta corrente", "Conta digital", "Poupança", "Carteira", "Investimento"].includes(record.type) ? record.type : "Conta corrente",
    openingBalance: Math.max(-1000000000000, Math.min(1000000000000, Number(record.openingBalance || 0))),
    includeNetWorth: record.includeNetWorth !== false,
    updated_at: normalizeTimestamp(record.updated_at) || new Date().toISOString(),
  };
}

function normalizeIncome(record) {
  if (!record || typeof record !== "object") return null;
  const amount = Math.max(0, Number(record.amount || 0));
  if (!amount) return null;
  return {
    id: safeRecordId(record.id),
    description: safeText(record.description, 160) || "Receita",
    amount,
    date: normalizeDate(record.date) || localDateKey(todayLocal()),
    accountId: safeText(record.accountId, 80),
    recurrenceGroup: safeText(record.recurrenceGroup, 80),
    imported: Boolean(record.imported),
    updated_at: normalizeTimestamp(record.updated_at) || new Date().toISOString(),
  };
}

function normalizeTransfer(record) {
  if (!record || typeof record !== "object") return null;
  const amount = Math.max(0, Number(record.amount || 0));
  const fromAccountId = safeText(record.fromAccountId, 80);
  const toAccountId = safeText(record.toAccountId, 80);
  if (!amount || !fromAccountId || !toAccountId || fromAccountId === toAccountId) return null;
  return {
    id: safeRecordId(record.id),
    description: safeText(record.description, 160) || "Transferência",
    amount,
    date: normalizeDate(record.date) || localDateKey(todayLocal()),
    fromAccountId,
    toAccountId,
    updated_at: normalizeTimestamp(record.updated_at) || new Date().toISOString(),
  };
}

function normalizeCard(record) {
  if (!record || typeof record !== "object") return null;
  return {
    id: safeRecordId(record.id),
    name: safeText(record.name, 80) || "Cartão",
    accountId: safeText(record.accountId, 80),
    limit: Math.max(0, Number(record.limit || 0)),
    closingDay: Math.min(28, Math.max(1, Math.round(Number(record.closingDay || 1)))),
    dueDay: Math.min(28, Math.max(1, Math.round(Number(record.dueDay || 1)))),
    updated_at: normalizeTimestamp(record.updated_at) || new Date().toISOString(),
  };
}

function mergeRecords(baseRecords, incomingRecords) {
  return [...[...baseRecords, ...incomingRecords].reduce((map, record) => {
    const current = map.get(record.id);
    if (!current || record.updated_at >= current.updated_at) map.set(record.id, record);
    return map;
  }, new Map()).values()];
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
    accounts: mergeRecords(base.accounts, incoming.accounts),
    incomes: mergeRecords(base.incomes, incoming.incomes),
    transfers: mergeRecords(base.transfers, incoming.transfers),
    cards: mergeRecords(base.cards, incoming.cards),
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
    accounts: normalized.accounts,
    incomes: normalized.incomes,
    transfers: normalized.transfers,
    cards: normalized.cards,
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
  if (cloudDeletionInProgress) return;
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
  if (cloudDeletionInProgress) return null;
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

async function replaceCloudStateWithoutDemo(snapshot, expectedRevision, retry = true) {
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
    setCloudStatus("synced", `Sincronizado ${formatSyncTime(meta.updatedAt)}`, "Dados de demonstração removidos; seus outros lançamentos foram mantidos.");
    return result;
  } catch (error) {
    if (error.status === 409 && retry && error.payload?.state) {
      const merged = mergeFinancialStates(error.payload.state, snapshot, true);
      return replaceCloudStateWithoutDemo(stripDemoFinancialState(merged), Number(error.payload.revision || 0), false);
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
  renderIntelligence(stats);
  renderFinance(stats);
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

function average(values) {
  return values.length ? values.reduce((total, value) => total + Number(value || 0), 0) / values.length : 0;
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(values.reduce((total, value) => total + (value - mean) ** 2, 0) / (values.length - 1));
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function expenseCycleKey(expense) {
  const anchor = cycleAnchorForDate(expense.data_emissao);
  return `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, "0")}`;
}

function calculateSpendingForecast(stats) {
  const currentKey = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, "0")}`;
  const totals = state.expenses.reduce((map, expense) => {
    const key = expenseCycleKey(expense);
    if (key >= currentKey) return map;
    map.set(key, (map.get(key) || 0) + Number(expense.valor_total || 0));
    return map;
  }, new Map());
  const history = [...totals.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([, total]) => total);
  const historicalMean = average(history);
  const paceProjection = stats.position === "current" ? stats.projected : stats.position === "past" ? stats.total : historicalMean;
  const forecast = history.length >= 2 ? paceProjection * 0.65 + historicalMean * 0.35 : paceProjection || historicalMean;
  const deviation = standardDeviation(history);
  const uncertainty = history.length >= 3 ? Math.max(forecast * 0.08, deviation * 1.28) : Math.max(forecast * 0.3, deviation);
  const variation = historicalMean ? deviation / historicalMean : 1;
  const confidence = history.length >= 6 && variation <= 0.25 ? "Alta" : history.length >= 3 && variation <= 0.5 ? "Média" : "Baixa";
  return {
    forecast: Math.max(0, forecast), lower: Math.max(0, forecast - uncertainty), upper: Math.max(0, forecast + uncertainty),
    confidence, historyCount: history.length, historicalMean, deviation,
  };
}

function forecastCashFlow(forecast, days, paceAdjustment = 0, incomeAdjustment = 0) {
  const todayKey = localDateKey(todayLocal());
  const assets = sum(state.accounts.filter((account) => account.includeNetWorth), (account) => accountBalance(account.id, todayKey));
  const monthlyIncome = Math.max(0, Number(state.settings.monthlyIncome || 0) + Number(incomeAdjustment || 0));
  const monthlyExpense = forecast.forecast * (1 + Number(paceAdjustment || 0) / 100);
  const factor = days / 30;
  return { days, income: monthlyIncome * factor, expense: monthlyExpense * factor, projectedBalance: assets + (monthlyIncome - monthlyExpense) * factor };
}

function normalizedMerchant(expense) {
  return safeText(expense.fornecedor || expense.descricao, 160).toLowerCase().replace(/\d+/g, "").replace(/[^a-zà-ÿ ]/gi, " ").replace(/\s+/g, " ").trim();
}

function detectAnomalies() {
  const expenses = state.expenses.filter((expense) => !String(expense.id).startsWith("sample-") || state.demoMode);
  const values = expenses.map((expense) => Number(expense.valor_total || 0)).filter((value) => value > 0);
  const center = median(values);
  const mad = median(values.map((value) => Math.abs(value - center)));
  const anomalies = [];
  const seen = new Map();
  expenses.forEach((expense) => {
    const value = Number(expense.valor_total || 0);
    const duplicateKey = `${expense.data_emissao}|${value.toFixed(2)}|${normalizedMerchant(expense)}`;
    if (seen.has(duplicateKey)) anomalies.push({ expense, type: "Possível duplicidade", explanation: "Mesma data, valor e descrição de outro lançamento." });
    else seen.set(duplicateKey, expense.id);
    const threshold = mad ? center + mad * 4.5 : center * 2.2;
    if (values.length >= 4 && value > threshold && value > center) anomalies.push({ expense, type: "Valor fora do padrão", explanation: `O valor ficou muito acima da mediana de ${currency(center)}.` });
  });
  return anomalies.slice(0, 12);
}

function detectSubscriptions() {
  const groups = state.expenses.reduce((map, expense) => {
    const key = normalizedMerchant(expense);
    if (!key) return map;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(expense);
    return map;
  }, new Map());
  const subscriptions = [];
  groups.forEach((items, key) => {
    const months = new Set(items.map((item) => item.data_emissao.slice(0, 7)));
    const amounts = items.map((item) => Number(item.valor_total || 0));
    const mean = average(amounts);
    const variation = mean ? standardDeviation(amounts) / mean : 1;
    if (months.size >= 2 && variation <= 0.12) subscriptions.push({ name: items[0].fornecedor || items[0].descricao || key, amount: mean, occurrences: items.length, confidence: months.size >= 3 ? 0.9 : 0.72 });
  });
  return subscriptions.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
}

function suggestExpenseCategory(expense) {
  const text = `${expense.fornecedor} ${expense.descricao} ${expense.itens_resumo}`.toLowerCase();
  const rules = [
    ["Mercado", ["mercado", "supermercado", "hortifruti", "atacad"]],
    ["Transporte", ["combust", "posto", "uber", "99 ", "ônibus", "estacion"]],
    ["Moradia", ["aluguel", "condomínio", "energia", "água", "gás"]],
    ["Saúde", ["farmácia", "medic", "consulta", "laboratório"]],
    ["Educação", ["curso", "faculdade", "escola", "livro"]],
    ["Assinaturas", ["stream", "assinatura", "netflix", "spotify", "cloud"]],
    ["Lazer", ["cinema", "restaurante", "viagem", "show"]],
  ];
  const match = rules.find(([, keywords]) => keywords.some((keyword) => text.includes(keyword)));
  return match ? { category: match[0], confidence: 0.86, reason: `Palavras do lançamento se relacionam com ${match[0]}.` } : { category: "Outros", confidence: 0.45, reason: "Não há informação suficiente para uma categoria mais específica." };
}

function renderIntelligence(stats) {
  const forecast = calculateSpendingForecast(stats);
  const horizons = [30, 60, 90].map((days) => forecastCashFlow(forecast, days));
  dom.forecastConfidence.textContent = `Confiança ${forecast.confidence.toLowerCase()}`;
  dom.forecastMetrics.innerHTML = [
    ["Projeção central", currency(forecast.forecast)],
    ["Limite inferior", currency(forecast.lower)],
    ["Limite superior", currency(forecast.upper)],
    ["Ciclos analisados", forecast.historyCount],
  ].map(([label, value]) => `<article class="metric-card"><span>${sanitizeText(label)}</span><strong>${sanitizeText(value)}</strong></article>`).join("");
  dom.forecastRange.textContent = `${currency(forecast.lower)} a ${currency(forecast.upper)}`;
  dom.forecastRangeBar.style.width = `${Math.min(100, forecast.forecast ? (forecast.upper - forecast.lower) / forecast.forecast * 100 : 100)}%`;
  dom.forecastExplanation.textContent = forecast.historyCount >= 3
    ? `Estimativa baseada no ritmo do ciclo atual e nos últimos ${forecast.historyCount} ciclos. A faixa aumenta quando os gastos históricos variam mais.`
    : "Ainda há pouco histórico. A faixa foi ampliada para deixar explícita a incerteza da estimativa.";
  dom.forecastHorizons.innerHTML = horizons.map((item) => `<article class="finance-row"><div><strong>${item.days} dias</strong><span>Entradas ${currency(item.income)} · saídas ${currency(item.expense)}</span></div><strong class="${item.projectedBalance >= 0 ? "positive-value" : "negative-value"}">${currency(item.projectedBalance)}</strong></article>`).join("");

  const anomalies = detectAnomalies();
  dom.anomalyList.innerHTML = anomalies.length ? anomalies.map((item) => `<article class="finance-row"><div><strong>${sanitizeText(item.type)}: ${sanitizeText(item.expense.fornecedor || item.expense.descricao)}</strong><span>${sanitizeText(item.explanation)}</span></div><strong>${currency(item.expense.valor_total)}</strong></article>`).join("") : `<p class="muted">Nenhuma anomalia relevante foi identificada com os dados disponíveis.</p>`;
  const subscriptions = detectSubscriptions();
  dom.subscriptionList.innerHTML = subscriptions.length ? subscriptions.map((item) => `<article class="finance-row"><div><strong>${sanitizeText(item.name)}</strong><span>${item.occurrences} ocorrências · confiança ${Math.round(item.confidence * 100)}%</span></div><strong>${currency(item.amount)}/mês</strong></article>`).join("") : `<p class="muted">São necessários pelo menos dois meses semelhantes para sugerir uma assinatura.</p>`;

  const classification = state.expenses.filter((expense) => expense.categoria === "Outros" || Number(expense.confianca_leitura || 0) < 0.75).slice(0, 12).map((expense) => ({ expense, suggestion: suggestExpenseCategory(expense) }));
  dom.classificationBadge.textContent = classification.length ? `${classification.length} para revisar` : "Tudo revisado";
  dom.classificationList.innerHTML = classification.length ? classification.map(({ expense, suggestion }) => `<article class="finance-row"><div><strong>${sanitizeText(expense.fornecedor || expense.descricao)}</strong><span>Sugestão: ${sanitizeText(suggestion.category)} · ${Math.round(suggestion.confidence * 100)}% · ${sanitizeText(suggestion.reason)}</span></div><button class="text-button" data-alert-expense-id="${expense.id}" type="button">Revisar</button></article>`).join("") : `<p class="muted">Nenhum lançamento precisa de classificação assistida.</p>`;
  renderScenario(forecast);
}

function renderScenario(forecast = calculateSpendingForecast(getStats())) {
  const pace = Number(dom.paceAdjustment.value || 0);
  const incomeAdjustment = Number(dom.incomeAdjustment.value || 0);
  const result = forecastCashFlow(forecast, 90, pace, incomeAdjustment);
  dom.paceAdjustmentLabel.textContent = `${pace > 0 ? "+" : ""}${pace}%`;
  dom.scenarioResult.innerHTML = [
    ["Gastos estimados em 90 dias", currency(result.expense)],
    ["Entradas estimadas em 90 dias", currency(result.income)],
    ["Saldo ao final do cenário", currency(result.projectedBalance)],
  ].map(([label, value]) => `<div class="summary-item"><span>${sanitizeText(label)}</span><strong>${sanitizeText(value)}</strong></div>`).join("");
}

function recordInSelectedCycle(date) {
  const parsed = parseLocalDate(date);
  const { start, endExclusive } = getCycleBounds();
  return parsed && parsed >= start && parsed < endExclusive;
}

function accountBalance(accountId, throughDate = "9999-12-31") {
  const account = state.accounts.find((item) => item.id === accountId);
  if (!account) return 0;
  const income = sum(state.incomes.filter((item) => item.accountId === accountId && item.date <= throughDate), (item) => item.amount);
  const expenses = sum(state.expenses.filter((item) => item.account_id === accountId && !item.card_id && item.status_pagamento === "Pago" && item.data_emissao <= throughDate), (item) => item.valor_total);
  const transfersIn = sum(state.transfers.filter((item) => item.toAccountId === accountId && item.date <= throughDate), (item) => item.amount);
  const transfersOut = sum(state.transfers.filter((item) => item.fromAccountId === accountId && item.date <= throughDate), (item) => item.amount);
  return Number(account.openingBalance || 0) + income + transfersIn - transfersOut - expenses;
}

function cardBill(cardId) {
  return sum(selectedExpenses().filter((expense) => expense.card_id === cardId), (expense) => expense.valor_total);
}

function renderFinance(stats) {
  const todayKey = localDateKey(todayLocal());
  const incomeCycle = sum(state.incomes.filter((item) => recordInSelectedCycle(item.date)), (item) => item.amount);
  const accountTotal = sum(state.accounts.filter((item) => item.includeNetWorth), (item) => accountBalance(item.id, todayKey));
  const cardDebt = sum(state.cards, (card) => cardBill(card.id));
  const netWorth = accountTotal - cardDebt;
  const unresolved = state.expenses.filter((expense) => !String(expense.id).startsWith("sample-") && !expense.account_id && !expense.card_id).length;
  dom.reconciliationBadge.textContent = unresolved ? `${unresolved} ${unresolved === 1 ? "lançamento sem conta" : "lançamentos sem conta"}` : "Sem pendências";

  const metrics = [
    ["Saldo em contas", currency(accountTotal)],
    ["Receitas do ciclo", currency(incomeCycle)],
    ["Faturas do ciclo", currency(cardDebt)],
    ["Patrimônio líquido", currency(netWorth)],
  ];
  dom.financeMetrics.innerHTML = metrics.map(([label, value]) => `<article class="metric-card"><span>${sanitizeText(label)}</span><strong>${sanitizeText(value)}</strong></article>`).join("");

  dom.accountsList.innerHTML = state.accounts.length ? state.accounts.map((account) => `
    <article class="finance-row">
      <div><strong>${sanitizeText(account.name)}</strong><span>${sanitizeText(account.type)}</span></div>
      <strong>${currency(accountBalance(account.id, todayKey))}</strong>
    </article>`).join("") : `<p class="muted">Adicione sua primeira conta ou carteira.</p>`;

  dom.incomeList.innerHTML = state.incomes.length ? [...state.incomes].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20).map((income) => `
    <article class="finance-row">
      <div><strong>${sanitizeText(income.description)}</strong><span>${dateBR(income.date)} · ${sanitizeText(accountName(income.accountId))}</span></div>
      <strong class="positive-value">+ ${currency(income.amount)}</strong>
    </article>`).join("") : `<p class="muted">Nenhuma receita registrada.</p>`;

  dom.transferList.innerHTML = state.transfers.length ? [...state.transfers].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20).map((transfer) => `
    <article class="finance-row">
      <div><strong>${sanitizeText(transfer.description)}</strong><span>${dateBR(transfer.date)} · ${sanitizeText(accountName(transfer.fromAccountId))} → ${sanitizeText(accountName(transfer.toAccountId))}</span></div>
      <strong>${currency(transfer.amount)}</strong>
    </article>`).join("") : `<p class="muted">Nenhuma transferência registrada.</p>`;

  dom.cardsList.innerHTML = state.cards.length ? state.cards.map((card) => {
    const bill = cardBill(card.id);
    const used = card.limit ? bill / card.limit * 100 : 0;
    return `<article class="card-summary"><div class="row-between"><div><strong>${sanitizeText(card.name)}</strong><span>Fecha dia ${card.closingDay} · vence dia ${card.dueDay}</span></div><strong>${currency(bill)}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, used)}%;background:${getBudgetColor(used)}"></div></div><small>${currency(Math.max(0, card.limit - bill))} de limite disponível</small></article>`;
  }).join("") : `<p class="muted">Nenhum cartão cadastrado.</p>`;

  const cycleBalance = incomeCycle - stats.total;
  dom.cashflowSummary.innerHTML = [
    ["Entradas no ciclo", currency(incomeCycle)],
    ["Saídas no ciclo", currency(stats.total)],
    ["Resultado do ciclo", currency(cycleBalance)],
    ["Contas pendentes", currency(stats.pending)],
  ].map(([label, value]) => `<div class="summary-item"><span>${sanitizeText(label)}</span><strong>${sanitizeText(value)}</strong></div>`).join("");
  dom.netWorthSummary.innerHTML = [
    ["Ativos em contas", currency(accountTotal)],
    ["Faturas consideradas", currency(cardDebt)],
    ["Patrimônio líquido", currency(netWorth)],
    ["Contas incluídas", state.accounts.filter((item) => item.includeNetWorth).length],
  ].map(([label, value]) => `<div class="summary-item"><span>${sanitizeText(label)}</span><strong>${sanitizeText(value)}</strong></div>`).join("");

  const monthAnchor = new Date(todayLocal().getFullYear(), todayLocal().getMonth(), 1);
  dom.cashflowTimeline.innerHTML = [0, 1, 2].map((offset) => {
    const start = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + offset, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const startKey = localDateKey(start);
    const endKey = localDateKey(end);
    const income = sum(state.incomes.filter((item) => item.date >= startKey && item.date < endKey), (item) => item.amount);
    const expense = sum(state.expenses.filter((item) => item.data_emissao >= startKey && item.data_emissao < endKey), (item) => item.valor_total);
    return `<article class="finance-row"><div><strong>${start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</strong><span>Entradas ${currency(income)} · saídas ${currency(expense)}</span></div><strong class="${income - expense >= 0 ? "positive-value" : "negative-value"}">${currency(income - expense)}</strong></article>`;
  }).join("");

  refreshFinancialSelects();
}

function accountName(id) {
  return state.accounts.find((account) => account.id === id)?.name || "Sem conta";
}

function refreshFinancialSelects() {
  const accountOptions = state.accounts.map((account) => `<option value="${account.id}">${sanitizeText(account.name)}</option>`).join("");
  [dom.incomeForm?.accountId, dom.transferForm?.fromAccountId, dom.transferForm?.toAccountId, dom.cardForm?.accountId, dom.importAccount, dom.manualForm?.account_id].forEach((select) => {
    if (!select) return;
    const previous = select.value;
    select.innerHTML = `${select === dom.manualForm?.account_id ? '<option value="">Sem conta vinculada</option>' : ""}${accountOptions}`;
    if ([...select.options].some((option) => option.value === previous)) select.value = previous;
  });
  if (dom.manualForm?.card_id) {
    const previous = dom.manualForm.card_id.value;
    dom.manualForm.card_id.innerHTML = `<option value="">Sem cartão</option>${state.cards.map((card) => `<option value="${card.id}">${sanitizeText(card.name)}</option>`).join("")}`;
    if ([...dom.manualForm.card_id.options].some((option) => option.value === previous)) dom.manualForm.card_id.value = previous;
  }
}

function renderAlertCards(container, alerts) {
  container.replaceChildren();
  alerts.forEach((alert) => {
    const card = document.createElement("article");
    card.className = `alert-card ${alert.type === "danger" ? "danger" : alert.type === "success" ? "success" : ""}`.trim();
    const text = document.createElement("span");
    text.textContent = alert.text;
    const content = document.createElement("div");
    const explanation = document.createElement("small");
    explanation.className = "alert-explanation";
    explanation.textContent = alert.explanation || explainAlert(alert.text);
    content.append(text, explanation);
    card.append(content);
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

function explainAlert(text) {
  const value = String(text || "").toLowerCase();
  if (value.includes("duplicada")) return "O aplicativo encontrou data, valor e descrição semelhantes em mais de um lançamento.";
  if (value.includes("venc")) return "A data de vencimento informada está próxima ou já passou.";
  if (value.includes("confiança")) return "Alguns campos do comprovante não puderam ser identificados com segurança suficiente.";
  if (value.includes("orçamento") || value.includes("utilizou")) return "O total registrado foi comparado ao limite disponível no ciclo.";
  if (value.includes("categoria")) return "Os gastos da categoria foram comparados ao limite configurado.";
  return "Este alerta foi gerado a partir dos lançamentos e limites cadastrados.";
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
  if (view === "profile") loadOperationalStatus();
}

function auditLabel(type) {
  return ({
    state_created: "Dados criados na nuvem",
    state_updated: "Dados sincronizados",
    state_restored: "Versão anterior restaurada",
    demo_data_removed: "Dados de exemplo removidos",
    client_error: "Falha de interface registrada",
    server_error: "Falha do serviço registrada",
  })[type] || "Evento operacional";
}

async function loadOperationalStatus() {
  if (!dom.serviceHealth) return;
  dom.serviceHealth.textContent = "Verificando";
  try {
    const [healthResponse, historyResponse, auditResponse] = await Promise.all([
      fetch("/api/health", { headers: { accept: "application/json" } }),
      fetch("/api/history", { headers: { accept: "application/json" } }),
      fetch("/api/audit", { headers: { accept: "application/json" } }),
    ]);
    if (![healthResponse, historyResponse, auditResponse].every((response) => response.ok)) throw new Error("Status indisponível");
    const [health, history, audit] = await Promise.all([healthResponse.json(), historyResponse.json(), auditResponse.json()]);
    dom.serviceHealth.textContent = health.status === "ok" ? "Serviço operacional" : "Atenção";
    dom.historyList.innerHTML = history.items?.length ? history.items.map((item) => `<article class="finance-row"><div><strong>Revisão ${Number(item.revision)}</strong><span>${new Date(item.created_at).toLocaleString("pt-BR")}</span></div><button class="text-button" data-restore-revision="${Number(item.revision)}" type="button">Restaurar</button></article>`).join("") : `<p class="muted">Os pontos de recuperação aparecerão após novas sincronizações.</p>`;
    dom.auditList.innerHTML = audit.items?.length ? audit.items.map((item) => `<article class="finance-row"><div><strong>${sanitizeText(auditLabel(item.eventType))}</strong><span>${new Date(item.createdAt).toLocaleString("pt-BR")}</span></div></article>`).join("") : `<p class="muted">Nenhum evento operacional registrado.</p>`;
    dom.securityMessage.textContent = "Histórico e auditoria atualizados.";
  } catch {
    dom.serviceHealth.textContent = navigator.onLine ? "Serviço indisponível" : "Sem conexão";
    dom.securityMessage.textContent = "Não foi possível consultar os controles operacionais agora.";
  }
}

async function restoreCloudRevision(revision) {
  if (!confirm(`Restaurar a revisão ${revision}? A versão atual continuará disponível no histórico.`)) return;
  const meta = loadCloudMeta();
  dom.securityMessage.textContent = "Restaurando dados...";
  try {
    const response = await fetch("/api/history/restore", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ revision, expectedRevision: meta.revision }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Falha na recuperação");
    applyFinancialState(payload.state);
    saveCloudMeta({ revision: payload.revision, pending: false, initialized: true, updatedAt: payload.updatedAt, email: payload.user?.email || meta.email });
    dom.securityMessage.textContent = "Dados restaurados com sucesso.";
    showToast("Versão anterior restaurada.");
    await loadOperationalStatus();
  } catch (error) {
    dom.securityMessage.textContent = safeText(error.message, 180) || "Não foi possível restaurar os dados.";
  }
}

async function eraseAllFinancialData() {
  const confirmation = prompt('Esta ação exclui dados atuais, histórico e auditoria. Digite EXCLUIR para confirmar.');
  if (confirmation !== "EXCLUIR") return;
  dom.eraseCloudData.disabled = true;
  dom.securityMessage.textContent = "Excluindo dados...";
  try {
    await deleteStoredFinancialData();
    dom.securityMessage.textContent = "Dados financeiros excluídos. O PIN local foi mantido.";
    showToast("Dados financeiros excluídos.");
    await loadOperationalStatus();
  } catch (error) {
    dom.securityMessage.textContent = safeText(error.message, 180) || "Não foi possível excluir os dados.";
  } finally {
    dom.eraseCloudData.disabled = false;
  }
}

function resetFinancialDataAfterDeletion() {
  const localWebhookUrl = state.settings.webhookUrl || "";
  state = createEmptyState(localWebhookUrl);
  selectedMonth = cycleAnchorForDate(localDateKey(todayLocal()));
  pendingStatementImport = [];
  lastDeletedExpense = null;
  selectedExpenseId = null;
  saveState();
  localStorage.removeItem(cloudMetaKey);
  render();
  dom.cloudAccount.textContent = "Conta autenticada";
  setCloudStatus("synced", "Nuvem pronta", "Nenhum dado financeiro salvo nesta conta.");
}

async function deleteStoredFinancialData() {
  cloudDeletionInProgress = true;
  window.clearTimeout(cloudSyncTimer);
  try {
    if (cloudSyncPromise) await cloudSyncPromise.catch(() => null);
    await cloudRequest("/api/account-data", {
      method: "DELETE",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ confirm: "EXCLUIR" }),
    });
    resetFinancialDataAfterDeletion();
  } finally {
    cloudDeletionInProgress = false;
  }
}

function reportClientError(area) {
  if (!navigator.onLine || dom.appShell.classList.contains("is-hidden")) return;
  fetch("/api/client-error", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "Erro não tratado", area: safeText(area, 60) }),
  }).catch(() => null);
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

function addMonthsToDateKey(dateKey, months) {
  const parsed = parseLocalDate(dateKey) || todayLocal();
  const targetMonth = new Date(parsed.getFullYear(), parsed.getMonth() + months, 1);
  const day = Math.min(parsed.getDate(), daysInMonth(targetMonth));
  return localDateKey(new Date(targetMonth.getFullYear(), targetMonth.getMonth(), day));
}

function createExpenseSeries(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const installments = Math.max(1, Math.min(24, Math.round(Number(data.installments || 1))));
  const recurrenceMonths = installments > 1 ? 1 : Math.max(1, Math.min(12, Math.round(Number(data.recurrence_months || 1))));
  const count = Math.max(installments, recurrenceMonths);
  const groupId = count > 1 ? crypto.randomUUID() : "";
  const originalTotal = Math.max(0, Number(data.valor_total || 0));
  const amount = installments > 1 ? Math.round(originalTotal / installments * 100) / 100 : originalTotal;
  return Array.from({ length: count }, (_, index) => normalizeExpense({
    ...data,
    id: crypto.randomUUID(),
    descricao: installments > 1 ? `${data.descricao} (${index + 1}/${installments})` : data.descricao,
    data_emissao: addMonthsToDateKey(data.data_emissao, index),
    data_vencimento: data.data_vencimento ? addMonthsToDateKey(data.data_vencimento, index) : "",
    valor_total: index === installments - 1 ? Math.round((originalTotal - amount * (installments - 1)) * 100) / 100 : amount,
    valor_produtos: index === installments - 1 ? Math.round((originalTotal - amount * (installments - 1)) * 100) / 100 : amount,
    account_id: data.card_id ? "" : data.account_id,
    installment_group: installments > 1 ? groupId : "",
    installment_number: installments > 1 ? index + 1 : 1,
    installment_total: installments,
    recurrence_group: recurrenceMonths > 1 ? groupId : "",
    status_pagamento: data.card_id ? "Pendente" : data.status_pagamento,
    origem: installments > 1 ? "Registro manual" : recurrenceMonths > 1 ? "Registro manual" : "Registro manual",
    updated_at: new Date().toISOString(),
  }));
}

function setFinanceTab(tab) {
  document.querySelectorAll(".finance-panel").forEach((panel) => panel.classList.toggle("is-active", panel.id === `${tab}FinancePanel`));
  document.querySelectorAll("[data-finance-tab]").forEach((button) => button.classList.toggle("is-active", button.dataset.financeTab === tab));
}

function handleAccountSubmit(event) {
  event.preventDefault();
  if (!dom.accountForm.reportValidity()) return;
  prepareForRealData();
  const data = Object.fromEntries(new FormData(dom.accountForm).entries());
  state.accounts.push(normalizeAccount({ ...data, id: crypto.randomUUID(), includeNetWorth: data.includeNetWorth === "on", updated_at: new Date().toISOString() }));
  dom.accountForm.reset();
  dom.accountForm.includeNetWorth.checked = true;
  markCloudChange();
  render();
  showToast("Conta adicionada e pronta para sincronizar.");
}

function handleIncomeSubmit(event) {
  event.preventDefault();
  if (!dom.incomeForm.reportValidity()) return;
  prepareForRealData();
  const data = Object.fromEntries(new FormData(dom.incomeForm).entries());
  const count = Math.max(1, Math.min(12, Number(data.recurrenceMonths || 1)));
  const groupId = count > 1 ? crypto.randomUUID() : "";
  const records = Array.from({ length: count }, (_, index) => normalizeIncome({
    id: crypto.randomUUID(), description: data.description, amount: data.amount,
    date: addMonthsToDateKey(data.date, index), accountId: data.accountId,
    recurrenceGroup: groupId, updated_at: new Date().toISOString(),
  })).filter(Boolean);
  state.incomes.push(...records);
  dom.incomeForm.reset();
  dom.incomeForm.date.value = localDateKey(todayLocal());
  markCloudChange();
  render();
  showToast(records.length > 1 ? `${records.length} receitas programadas.` : "Receita registrada.");
}

function handleTransferSubmit(event) {
  event.preventDefault();
  if (!dom.transferForm.reportValidity()) return;
  const data = Object.fromEntries(new FormData(dom.transferForm).entries());
  if (data.fromAccountId === data.toAccountId) {
    showToast("Escolha contas diferentes para a transferência.");
    return;
  }
  prepareForRealData();
  const transfer = normalizeTransfer({ ...data, id: crypto.randomUUID(), updated_at: new Date().toISOString() });
  if (!transfer) return;
  state.transfers.push(transfer);
  dom.transferForm.reset();
  dom.transferForm.date.value = localDateKey(todayLocal());
  markCloudChange();
  render();
  showToast("Transferência registrada sem alterar receitas ou despesas.");
}

function handleCardSubmit(event) {
  event.preventDefault();
  if (!dom.cardForm.reportValidity()) return;
  prepareForRealData();
  const data = Object.fromEntries(new FormData(dom.cardForm).entries());
  state.cards.push(normalizeCard({ ...data, id: crypto.randomUUID(), updated_at: new Date().toISOString() }));
  dom.cardForm.reset();
  markCloudChange();
  render();
  showToast("Cartão adicionado.");
}

function parseStatementDate(value) {
  const text = safeText(value, 32);
  const ofx = text.match(/^(\d{4})(\d{2})(\d{2})/);
  if (ofx) return `${ofx[1]}-${ofx[2]}-${ofx[3]}`;
  const br = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return normalizeDate(text);
}

function parseCsvStatement(text) {
  const lines = String(text).replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const delimiter = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ";" : ",";
  const headers = lines[0].split(delimiter).map((item) => item.trim().toLowerCase());
  const indexOf = (names) => headers.findIndex((header) => names.some((name) => header.includes(name)));
  const dateIndex = indexOf(["data", "date"]);
  const descriptionIndex = indexOf(["descr", "hist", "memo", "lançamento", "lancamento"]);
  const amountIndex = indexOf(["valor", "amount", "quantia"]);
  if (dateIndex < 0 || amountIndex < 0) return [];
  return lines.slice(1).map((line) => {
    const columns = line.split(delimiter).map((item) => item.replace(/^"|"$/g, "").trim());
    const rawAmount = columns[amountIndex] || "";
    const amount = parseMoney(rawAmount.replace(/\s/g, ""));
    const negative = /^-/.test(rawAmount) || /débito|debito/i.test(line);
    return { date: parseStatementDate(columns[dateIndex]), description: safeText(columns[descriptionIndex] || "Lançamento importado", 160), amount: negative ? -Math.abs(amount) : Math.abs(amount) };
  }).filter((item) => item.date && item.amount);
}

function parseOfxStatement(text) {
  return [...String(text).matchAll(/<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>))/gi)].map((match) => {
    const block = match[1];
    const value = (tag) => block.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, "i"))?.[1]?.trim() || "";
    const amount = Number(value("TRNAMT").replace(",", "."));
    return { date: parseStatementDate(value("DTPOSTED")), description: safeText(value("MEMO") || value("NAME") || "Lançamento OFX", 160), amount };
  }).filter((item) => item.date && Number.isFinite(item.amount) && item.amount !== 0);
}

function statementKey(item) {
  return `${item.date}|${Math.abs(Number(item.amount)).toFixed(2)}|${safeText(item.description, 160).toLowerCase().replace(/\s+/g, " ")}`;
}

async function handleStatementFile(event) {
  const file = event.target.files?.[0];
  pendingStatementImport = [];
  dom.confirmImport.classList.add("is-hidden");
  if (!file) return;
  const text = await file.text();
  const parsed = /\.ofx$/i.test(file.name) || /<OFX/i.test(text) ? parseOfxStatement(text) : parseCsvStatement(text);
  const existing = new Set([
    ...state.expenses.map((item) => statementKey({ date: item.data_emissao, amount: -item.valor_total, description: item.descricao })),
    ...state.incomes.map((item) => statementKey({ date: item.date, amount: item.amount, description: item.description })),
  ]);
  pendingStatementImport = parsed.map((item) => ({ ...item, duplicate: existing.has(statementKey(item)) }));
  const newCount = pendingStatementImport.filter((item) => !item.duplicate).length;
  dom.importPreview.innerHTML = pendingStatementImport.length ? pendingStatementImport.slice(0, 100).map((item) => `<article class="finance-row ${item.duplicate ? "is-duplicate" : ""}"><div><strong>${sanitizeText(item.description)}</strong><span>${dateBR(item.date)} · ${item.duplicate ? "possível duplicidade" : "novo lançamento"}</span></div><strong class="${item.amount >= 0 ? "positive-value" : "negative-value"}">${item.amount >= 0 ? "+ " : "- "}${currency(Math.abs(item.amount))}</strong></article>`).join("") : `<p class="muted">Nenhum lançamento reconhecido. Confira se o arquivo possui data, descrição e valor.</p>`;
  dom.importMessage.textContent = `${parsed.length} lançamentos lidos; ${newCount} prontos para importar.`;
  dom.confirmImport.classList.toggle("is-hidden", newCount === 0 || !dom.importAccount.value);
}

function confirmStatementImport() {
  const accountId = dom.importAccount.value;
  if (!accountId) return;
  prepareForRealData();
  const items = pendingStatementImport.filter((item) => !item.duplicate);
  items.forEach((item) => {
    if (item.amount > 0) state.incomes.push(normalizeIncome({ id: crypto.randomUUID(), description: item.description, amount: item.amount, date: item.date, accountId, imported: true, updated_at: new Date().toISOString() }));
    else state.expenses.push(normalizeExpense({ id: crypto.randomUUID(), descricao: item.description, valor_total: Math.abs(item.amount), valor_produtos: Math.abs(item.amount), data_emissao: item.date, data_registro: localDateKey(todayLocal()), categoria: "Outros", forma_pagamento: "Transferência", status_pagamento: "Pago", account_id: accountId, origem: "Registro manual", imported: true, updated_at: new Date().toISOString() }));
  });
  pendingStatementImport = [];
  dom.statementFile.value = "";
  dom.confirmImport.classList.add("is-hidden");
  dom.importPreview.innerHTML = "";
  dom.importMessage.textContent = `${items.length} lançamentos importados e conciliados.`;
  markCloudChange();
  render();
  showToast("Extrato importado com verificação de duplicidades.");
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
    account_id: safeText(source.account_id || source.accountId, 80),
    card_id: safeText(source.card_id || source.cardId, 80),
    installment_group: safeText(source.installment_group || source.installmentGroup, 80),
    installment_number: Math.max(1, Math.min(24, Math.round(Number(source.installment_number || source.installmentNumber || 1)))),
    installment_total: Math.max(1, Math.min(24, Math.round(Number(source.installment_total || source.installmentTotal || 1)))),
    recurrence_group: safeText(source.recurrence_group || source.recurrenceGroup, 80),
    imported: Boolean(source.imported),
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

async function clearDemoData(triggerButton = dom.clearDemoData) {
  if (!confirm("Remover somente os dados de demonstração? Seus outros lançamentos serão mantidos.")) return;
  const button = triggerButton || dom.clearDemoData;
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Removendo...";
  try {
    await syncCloud({ manual: true });
    if (loadCloudMeta().pending) throw new Error("Sincronize suas alterações antes de remover os exemplos.");
    cloudDeletionInProgress = true;
    window.clearTimeout(cloudSyncTimer);
    if (cloudSyncPromise) await cloudSyncPromise.catch(() => null);
    const result = await cloudRequest("/api/account-data/remove-demo", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ confirm: "REMOVER_EXEMPLOS" }),
    });
    if (result.state) applyFinancialState(result.state);
    const meta = loadCloudMeta();
    meta.revision = Number(result.revision || meta.revision || 0);
    meta.updatedAt = normalizeTimestamp(result.updatedAt) || meta.updatedAt || new Date().toISOString();
    meta.pending = false;
    meta.initialized = true;
    meta.email = safeText(result.user?.email || meta.email, 320);
    saveCloudMeta(meta);
    const preservedExpenses = Number(result.summary?.preservedExpenses ?? state.expenses.length);
    const preservedMessage = preservedExpenses === 1
      ? "1 lançamento foi mantido."
      : `${preservedExpenses} lançamentos foram mantidos.`;
    setCloudStatus("synced", `Sincronizado ${formatSyncTime(meta.updatedAt)}`, `Dados de exemplo removidos. ${preservedMessage}`);
    await loadOperationalStatus();
    showToast(result.changed === false ? "Nenhum dado de demonstração foi encontrado." : `Dados de exemplo removidos. ${preservedMessage}`);
  } catch (error) {
    showToast(safeText(error.message, 180) || "Não foi possível remover os dados de demonstração.");
  } finally {
    cloudDeletionInProgress = false;
    button.disabled = false;
    button.textContent = originalLabel;
  }
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
  dom.clearDemoData.addEventListener("click", (event) => clearDemoData(event.currentTarget));
  dom.searchInput.addEventListener("input", renderExpenses);
  dom.showUpload.addEventListener("click", () => toggleAddMode("upload"));
  dom.showManual.addEventListener("click", () => toggleAddMode("manual"));
  dom.receiptInput.addEventListener("change", handleFileSelect);
  dom.removeImage.addEventListener("click", clearSelectedImage);
  dom.sendReceipt.addEventListener("click", sendReceipt);
  dom.manualForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const expenses = createExpenseSeries(dom.manualForm);
    const expense = expenses[0];
    prepareForRealData();
    state.expenses.unshift(...expenses);
    state.deletedExpenses = state.deletedExpenses.filter((item) => !expenses.some((expenseItem) => item.id === expenseItem.id));
    markCloudChange();
    dom.manualForm.reset();
    dom.manualForm.data_emissao.value = localDateKey(todayLocal());
    dom.manualForm.status_pagamento.value = "Pago";
    selectedMonth = cycleAnchorForDate(expense.data_emissao);
    render();
    setView("home");
    showToast(expenses.length > 1 ? `${expenses.length} lançamentos criados e prontos para sincronizar.` : "Gasto salvo e pronto para sincronizar.");
  });
  document.querySelectorAll("[data-finance-tab]").forEach((button) => button.addEventListener("click", () => setFinanceTab(button.dataset.financeTab)));
  dom.accountForm.addEventListener("submit", handleAccountSubmit);
  dom.incomeForm.addEventListener("submit", handleIncomeSubmit);
  dom.transferForm.addEventListener("submit", handleTransferSubmit);
  dom.cardForm.addEventListener("submit", handleCardSubmit);
  dom.statementFile.addEventListener("change", handleStatementFile);
  dom.confirmImport.addEventListener("click", confirmStatementImport);
  dom.refreshOperations.addEventListener("click", loadOperationalStatus);
  dom.removeDemoData.addEventListener("click", (event) => clearDemoData(event.currentTarget));
  dom.eraseCloudData.addEventListener("click", eraseAllFinancialData);
  dom.historyList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-restore-revision]");
    if (button) restoreCloudRevision(Number(button.dataset.restoreRevision));
  });
  dom.paceAdjustment.addEventListener("input", () => renderScenario());
  dom.incomeAdjustment.addEventListener("input", () => renderScenario());
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
  [dom.homeAlerts, dom.alertsList, dom.classificationList].forEach((container) => container.addEventListener("click", handleAlertAction));
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
  window.addEventListener("error", () => reportClientError("window_error"));
  window.addEventListener("unhandledrejection", () => reportClientError("unhandled_rejection"));
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
  dom.incomeForm.date.value = localDateKey(todayLocal());
  dom.transferForm.date.value = localDateKey(todayLocal());
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
