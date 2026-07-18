const categories = [
  "Alimentacao",
  "Mercado",
  "Transporte",
  "Moradia",
  "Saude",
  "Educacao",
  "Lazer",
  "Assinaturas",
  "Compras",
  "Servicos",
  "Impostos",
  "Equipamentos",
  "Outros",
];

const paymentMethods = ["Pix", "Cartao de credito", "Cartao de debito", "Dinheiro", "Boleto", "Transferencia"];
const processingLabels = [
  "Enviando imagem.",
  "Lendo comprovante.",
  "Identificando a compra.",
  "Organizando os valores.",
  "Salvando o gasto.",
  "Atualizando o controle mensal.",
];

const storageKey = "controleFinanceiro:v2";
const pinKey = "controleFinanceiro:pin";
const authSessionKey = "controleFinanceiro:authSession";
const currentDate = new Date();

let selectedMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
let selectedFile = null;
let pendingReview = null;
let selectedExpenseId = null;

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
    forma_pagamento: "Cartao de credito",
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
    descricao: "Combustivel",
    forma_pagamento: "Pix",
    valor_produtos: 180,
    valor_frete: 0,
    valor_desconto: 0,
    valor_total: 180,
    status_pagamento: "Pago",
    itens_json: [{ nome: "Combustivel", valor: 180 }],
    dica_financeira: "Acompanhe este gasto semanalmente para evitar surpresa no fim do mes.",
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
    forma_pagamento: "Cartao de credito",
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
    fornecedor: "Farmacia Vida",
    cnpj_fornecedor: "",
    numero_nota: "5510",
    data_emissao: "2026-06-05",
    data_vencimento: "",
    status_vencimento: "Em dia",
    categoria: "Saude",
    descricao: "Medicamentos",
    forma_pagamento: "Cartao de debito",
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

const dom = {
  authScreen: document.querySelector("#authScreen"),
  appShell: document.querySelector("#appShell"),
  pinInput: document.querySelector("#pinInput"),
  authButton: document.querySelector("#authButton"),
  authMessage: document.querySelector("#authMessage"),
  currentMonthLabel: document.querySelector("#currentMonthLabel"),
  prevMonth: document.querySelector("#prevMonth"),
  nextMonth: document.querySelector("#nextMonth"),
  availableValue: document.querySelector("#availableValue"),
  budgetValue: document.querySelector("#budgetValue"),
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
  expensesList: document.querySelector("#expensesList"),
  searchInput: document.querySelector("#searchInput"),
  staleBanner: document.querySelector("#staleBanner"),
  refreshDashboard: document.querySelector("#refreshDashboard"),
  refreshData: document.querySelector("#refreshData"),
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
  reviewModal: document.querySelector("#reviewModal"),
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
  markPaid: document.querySelector("#markPaid"),
  markPending: document.querySelector("#markPending"),
  shareExpense: document.querySelector("#shareExpense"),
  deleteExpense: document.querySelector("#deleteExpense"),
  filterDrawer: document.querySelector("#filterDrawer"),
  filterForm: document.querySelector("#filterForm"),
  openFilters: document.querySelector("#openFilters"),
  closeFilters: document.querySelector("#closeFilters"),
  clearFilters: document.querySelector("#clearFilters"),
};

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(defaultState);
  try {
    const parsed = JSON.parse(saved);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      settings: { ...structuredClone(defaultState).settings, ...(parsed.settings || {}) },
      filters: { ...structuredClone(defaultState).filters, ...(parsed.filters || {}) },
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
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

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function expenseMonthKey(expense) {
  return String(expense.data_emissao || expense.data_registro || "").slice(0, 7);
}

function selectedExpenses() {
  return state.expenses.filter((expense) => expenseMonthKey(expense) === monthKey(selectedMonth));
}

function previousMonthExpenses() {
  const previous = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1);
  return state.expenses.filter((expense) => expenseMonthKey(expense) === monthKey(previous));
}

function sum(list, selector) {
  return list.reduce((total, item) => total + Number(selector(item) || 0), 0);
}

function sanitizeText(value) {
  return String(value ?? "").replace(/[<>&]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[char]));
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
  const total = sum(expenses, (expense) => expense.valor_total);
  const previousTotal = sum(previous, (expense) => expense.valor_total);
  const paid = sum(expenses.filter((expense) => expense.status_pagamento === "Pago"), (expense) => expense.valor_total);
  const pending = sum(expenses.filter((expense) => expense.status_pagamento === "Pendente"), (expense) => expense.valor_total);
  const largest = expenses.reduce((max, expense) => (Number(expense.valor_total) > Number(max?.valor_total || 0) ? expense : max), null);
  const categoryTotals = groupTotals(expenses, "categoria");
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  const dailyAverage = total / Math.max(1, Math.min(new Date().getDate(), daysInMonth(selectedMonth)));
  const avgPurchase = expenses.length ? total / expenses.length : 0;
  const percentUsed = state.settings.monthlyLimit ? (total / state.settings.monthlyLimit) * 100 : 0;
  const available = Number(state.settings.monthlyLimit || 0) - total;

  return { expenses, previous, total, previousTotal, paid, pending, largest, categoryTotals, topCategory, dailyAverage, avgPurchase, percentUsed, available };
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
  dom.currentMonthLabel.textContent = selectedMonth.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "");
  dom.availableValue.textContent = currency(stats.available);
  dom.budgetValue.textContent = currency(state.settings.monthlyLimit);
  dom.spentValue.textContent = `Gasto: ${currency(stats.total)}`;
  dom.budgetPercent.textContent = `${Math.round(stats.percentUsed)}%`;
  dom.budgetBar.style.width = `${Math.min(140, stats.percentUsed)}%`;
  dom.budgetBar.style.background = getBudgetColor(stats.percentUsed);
  dom.remainingDays.textContent = `${Math.max(0, daysInMonth(selectedMonth) - currentDate.getDate())} dias restantes`;
  dom.budgetHint.textContent = projectedMessage(stats);

  renderMetrics(stats);
  renderSummary(stats);
  renderAlerts(stats);
  renderExpenses();
  renderSettings();
  drawCharts(stats);
  saveState();
}

async function refreshDataNow() {
  const originalLabel = dom.refreshData.textContent;
  dom.refreshData.disabled = true;
  dom.refreshData.textContent = "Atualizando...";
  dom.refreshData.classList.remove("is-updated");

  state = loadState();
  dom.staleBanner.classList.add("is-hidden");
  render();
  await navigator.serviceWorker?.getRegistration?.().then((registration) => registration?.update()).catch(() => null);

  dom.refreshData.textContent = "Atualizado";
  dom.refreshData.classList.add("is-updated");
  window.setTimeout(() => {
    dom.refreshData.disabled = false;
    dom.refreshData.textContent = originalLabel.trim() || "Atualizar dados";
    dom.refreshData.classList.remove("is-updated");
  }, 1400);
}

function projectedMessage(stats) {
  const day = currentDate.getMonth() === selectedMonth.getMonth() ? currentDate.getDate() : daysInMonth(selectedMonth);
  const projected = stats.dailyAverage * daysInMonth(selectedMonth);
  if (projected > Number(state.settings.monthlyLimit || 0)) {
    return "Mantendo o ritmo atual, seus gastos podem ultrapassar o limite definido para este mes.";
  }
  return `Estimativa ate o fim do mes: ${currency(projected)}.`;
}

function renderMetrics(stats) {
  const metrics = [
    ["Total gasto no mes", currency(stats.total)],
    ["Limite mensal definido", currency(state.settings.monthlyLimit)],
    ["Valor disponivel", currency(stats.available)],
    ["Percentual utilizado", `${Math.round(stats.percentUsed)}%`],
    ["Compras registradas", String(stats.expenses.length)],
    ["Contas pendentes", currency(stats.pending)],
    ["Media de gastos por dia", currency(stats.dailyAverage)],
    ["Categoria com maior gasto", stats.topCategory ? stats.topCategory[0] : "-"],
  ];
  dom.metricsGrid.innerHTML = metrics.map(([label, value]) => `<article class="metric-card"><span>${label}</span><strong>${value}</strong></article>`).join("");
}

function renderSummary(stats) {
  const diff = stats.previousTotal ? ((stats.total - stats.previousTotal) / stats.previousTotal) * 100 : 0;
  const comparison = stats.previousTotal
    ? `${stats.total > stats.previousTotal ? "Gastou mais" : "Gastou menos"}: ${Math.abs(diff).toFixed(1).replace(".", ",")}%`
    : "Sem mes anterior";
  dom.monthComparisonBadge.textContent = comparison;

  const currentCategories = stats.categoryTotals;
  const prevCategories = groupTotals(stats.previous, "categoria");
  const deltas = categories.map((category) => [category, (currentCategories[category] || 0) - (prevCategories[category] || 0)]);
  const increased = deltas.sort((a, b) => b[1] - a[1])[0];
  const reduced = [...deltas].sort((a, b) => a[1] - b[1])[0];

  const items = [
    ["Total gasto", currency(stats.total)],
    ["Quantidade de compras", stats.expenses.length],
    ["Maior compra do mes", stats.largest ? `${stats.largest.fornecedor || stats.largest.descricao} (${currency(stats.largest.valor_total)})` : "-"],
    ["Media por compra", currency(stats.avgPurchase)],
    ["Media diaria", currency(stats.dailyAverage)],
    ["Total pago", currency(stats.paid)],
    ["Total pendente", currency(stats.pending)],
    ["Valor restante do orcamento", currency(stats.available)],
    ["Categoria que mais aumentou", increased && increased[1] > 0 ? increased[0] : "-"],
    ["Categoria que mais reduziu", reduced && reduced[1] < 0 ? reduced[0] : "-"],
  ];
  dom.summaryList.innerHTML = items.map(([label, value]) => `<div class="summary-item"><span>${label}</span><strong>${sanitizeText(value)}</strong></div>`).join("");
}

function buildAlerts(stats) {
  const alerts = [];
  if (stats.percentUsed >= 100) alerts.push(["danger", "Seu limite mensal foi ultrapassado."]);
  else if (stats.percentUsed >= 90) alerts.push(["danger", `Voce ja utilizou ${Math.round(stats.percentUsed)}% do seu limite mensal.`]);
  else if (stats.percentUsed >= 70) alerts.push(["attention", `Voce ja utilizou ${Math.round(stats.percentUsed)}% do seu limite mensal.`]);

  const today = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  stats.expenses.forEach((expense) => {
    if (expense.status_pagamento !== "Pendente" || !expense.data_vencimento) return;
    const due = new Date(`${expense.data_vencimento}T00:00:00`);
    const days = Math.round((due - today) / 86400000);
    if (days < 0) alerts.push(["danger", `${expense.descricao || expense.fornecedor} esta vencido.`]);
    else if (days <= 3) alerts.push(["attention", `${expense.descricao || expense.fornecedor} vence em ate tres dias.`]);
  });

  const average = stats.avgPurchase;
  stats.expenses.forEach((expense) => {
    if (average && Number(expense.valor_total) > average * 2.2) alerts.push(["attention", `${expense.descricao || expense.fornecedor} ficou muito acima da media.`]);
    if (Number(expense.confianca_leitura) < 0.75) alerts.push(["attention", "Uma leitura de comprovante esta com baixa confianca."]);
  });

  const seen = new Set();
  stats.expenses.forEach((expense) => {
    const key = `${expense.data_emissao}|${expense.valor_total}|${expense.fornecedor || expense.descricao}`;
    if (seen.has(key)) alerts.push(["attention", "Possivel compra duplicada identificada."]);
    seen.add(key);
  });

  Object.entries(state.settings.categoryLimits || {}).forEach(([category, limit]) => {
    if (limit && (stats.categoryTotals[category] || 0) > limit) alerts.push(["danger", `${category} ultrapassou o limite definido.`]);
  });

  if (!alerts.length) alerts.push(["success", "Nenhum alerta financeiro neste mes."]);
  return alerts;
}

function renderAlerts(stats) {
  const alerts = buildAlerts(stats);
  const html = alerts.map(([type, text]) => `<article class="alert-card ${type === "danger" ? "danger" : type === "success" ? "success" : ""}">${sanitizeText(text)}</article>`).join("");
  dom.homeAlerts.innerHTML = alerts.slice(0, 4).map(([type, text]) => `<article class="alert-card ${type === "danger" ? "danger" : type === "success" ? "success" : ""}">${sanitizeText(text)}</article>`).join("");
  dom.alertsList.innerHTML = html;
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
  dom.settingsForm.webhookUrl.value = getWebhookUrl(false);
  dom.categoryLimits.innerHTML = categories.map((category) => `
    <label class="category-limit-row">
      <span>${category}</span>
      <input name="limit_${category}" type="number" min="0" step="0.01" value="${state.settings.categoryLimits?.[category] || ""}" />
    </label>
  `).join("");
}

function drawCharts(stats) {
  drawRing("budgetRing", stats.percentUsed);
  drawBarChart("categoryChart", Object.entries(stats.categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 7), "#2462a7");
  drawBarChart("weekChart", weekTotals(stats.expenses), "#1f9d68");
  drawLineChart("evolutionChart", dailyTotals(stats.expenses), "#2462a7");
  drawBarChart("statusChart", [["Pago", stats.paid], ["Pendente", stats.pending]], "#ee7b27");
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
  const totals = [0, 0, 0, 0, 0].map((value, index) => [`Semana ${index + 1}`, value]);
  expenses.forEach((expense) => {
    const day = Number(String(expense.data_emissao).slice(8, 10)) || 1;
    const week = Math.min(4, Math.floor((day - 1) / 7));
    totals[week][1] += Number(expense.valor_total || 0);
  });
  return totals;
}

function dailyTotals(expenses) {
  let running = 0;
  return Array.from({ length: daysInMonth(selectedMonth) }, (_, index) => {
    const day = index + 1;
    running += sum(expenses.filter((expense) => Number(String(expense.data_emissao).slice(8, 10)) === day), (expense) => expense.valor_total);
    return [String(day), running];
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
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.view === view));
}

function getWebhookUrl(showMessage = true) {
  const configured = window.N8N_UPLOAD_WEBHOOK_URL || document.querySelector('meta[name="N8N_UPLOAD_WEBHOOK_URL"]')?.content || localStorage.getItem("N8N_UPLOAD_WEBHOOK_URL") || state.settings.webhookUrl || "";
  if (!configured && showMessage) {
    dom.uploadMessage.textContent = "Configure a URL do webhook n8n em Perfil antes de enviar.";
  }
  return configured;
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
  const total = parseMoney(pickValue(source, ["valor_total", "valorTotal", "total", "valor", "valor_compra", "valor_gasto", "amount"]));
  const products = parseMoney(pickValue(source, ["valor_produtos", "valorProdutos", "subtotal", "valor_itens", "valor_dos_produtos"])) || total;
  const shipping = parseMoney(pickValue(source, ["valor_frete", "valorFrete", "frete"]));
  const discount = parseMoney(pickValue(source, ["valor_desconto", "valorDesconto", "desconto"]));
  const supplier = pickValue(source, ["fornecedor", "estabelecimento", "nome_estabelecimento", "nomeEstabelecimento", "loja", "empresa", "merchant"]);
  const description = pickValue(source, ["descricao", "descricao_gasto", "descricaoGasto", "resumo", "itens_resumo", "nome_compra"]);
  const issueDate = normalizeDate(pickValue(source, ["data_emissao", "dataEmissao", "data_compra", "dataCompra", "data", "emissao"]));
  const dueDate = normalizeDate(pickValue(source, ["data_vencimento", "dataVencimento", "vencimento"]));
  const confidence = parseConfidence(pickValue(source, ["confianca_leitura", "confiancaLeitura", "confianca", "confidence", "score"]));
  const items = pickValue(source, ["itens_json", "itens", "itens_comprados", "items", "produtos"]);

  return {
    id: source.id || crypto.randomUUID(),
    data_registro: normalizeDate(pickValue(source, ["data_registro", "dataRegistro"])) || new Date().toISOString().slice(0, 10),
    fornecedor: supplier || "",
    cnpj_fornecedor: pickValue(source, ["cnpj_fornecedor", "cnpjFornecedor", "cnpj", "cnpj_estabelecimento"]) || "",
    numero_nota: pickValue(source, ["numero_nota", "numeroNota", "numero_da_nota", "numero", "nf", "nota_fiscal", "chave_acesso"]) || "",
    data_emissao: issueDate || new Date().toISOString().slice(0, 10),
    data_vencimento: dueDate || "",
    status_vencimento: pickValue(source, ["status_vencimento", "statusVencimento"]) || "",
    categoria: normalizeCategory(pickValue(source, ["categoria", "category"])) || "Outros",
    descricao: description || supplier || "Gasto",
    forma_pagamento: normalizePaymentMethod(pickValue(source, ["forma_pagamento", "formaPagamento", "pagamento", "meio_pagamento"])) || "Pix",
    valor_produtos: products,
    valor_frete: shipping,
    valor_desconto: discount,
    valor_total: total,
    status_pagamento: normalizePaymentStatus(pickValue(source, ["status_pagamento", "statusPagamento", "status", "situacao"])) || "Pendente",
    itens_json: Array.isArray(items) ? items : parseJson(items, []),
    dica_financeira: pickValue(source, ["dica_financeira", "dicaFinanceira", "dica"]) || "",
    alerta_financeiro: pickValue(source, ["alerta_financeiro", "alertaFinanceiro", "alerta"]) || "",
    confianca_leitura: confidence,
    observacoes: pickValue(source, ["observacoes", "observacao", "obs"]) || "",
    itens_resumo: pickValue(source, ["itens_resumo", "itensResumo", "resumo_itens"]) || summarizeItems(items),
    qtd_itens: Number(pickValue(source, ["qtd_itens", "qtdItens", "quantidade_itens"]) || (Array.isArray(items) ? items.length : 0)),
    nf_json_completo: pickValue(source, ["nf_json_completo", "nfJsonCompleto"]) || JSON.stringify(source),
    origem: source.origem || "Comprovante",
  };
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
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${year}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }
  return "";
}

function normalizeCategory(value) {
  if (!value) return "";
  const normalized = normalizeKey(value);
  return categories.find((category) => normalizeKey(category) === normalized) || String(value);
}

function normalizePaymentMethod(value) {
  if (!value) return "";
  const normalized = normalizeKey(value);
  return paymentMethods.find((method) => normalizeKey(method) === normalized) || String(value);
}

function normalizePaymentStatus(value) {
  if (!value) return "";
  const normalized = normalizeKey(value);
  if (["pago", "paga", "quitado", "quitada", "paid"].includes(normalized)) return "Pago";
  if (["pendente", "aberto", "emaberto", "vencido", "vencida", "pending"].includes(normalized)) return "Pendente";
  return String(value);
}

function parseConfidence(value) {
  const parsed = parseMoney(value);
  if (!parsed) return 0.8;
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

  try {
    await animateProcessing();
    const response = await fetch(webhookUrl, { method: "POST", body: formData });
    if (!response.ok) throw new Error("Erro no envio.");
    const responseText = await response.text();
    const payload = parsePayloadValue(responseText);
    const extractedPayload = extractExpensePayload(payload);
    const identified = normalizeExpense(extractedPayload);
    if (!scoreExpenseCandidate(extractedPayload)) {
      identified.confianca_leitura = 0.45;
      identified.alerta_financeiro = "O n8n respondeu, mas o app nao reconheceu os campos retornados.";
    }
    pendingReview = identified;
    openReview(identified);
    dom.uploadMessage.textContent = Number(identified.confianca_leitura) < 0.75
      ? "Comprovante recebido. Alguns campos precisam de revisao."
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
    dom.uploadMessage.textContent = "Falha de conexao ou leitura. Voce pode revisar e salvar manualmente.";
  } finally {
    setProcessing(false);
  }
}

function validateFile(file) {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    dom.uploadMessage.textContent = "Formato invalido. Use JPG, JPEG, PNG ou WEBP.";
    return false;
  }
  if (file.size > 8 * 1024 * 1024) {
    dom.uploadMessage.textContent = "Imagem muito grande. Envie um arquivo de ate 8 MB.";
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

function openReview(expense) {
  dom.confidenceWarning.classList.toggle("is-hidden", Number(expense.confianca_leitura) >= 0.75);
  const fields = [
    ["fornecedor", "Nome do estabelecimento", "text"],
    ["cnpj_fornecedor", "CNPJ", "text"],
    ["numero_nota", "Numero da nota", "text"],
    ["data_emissao", "Data da compra", "date"],
    ["data_vencimento", "Data de vencimento", "date"],
    ["categoria", "Categoria", "select"],
    ["descricao", "Descricao", "text"],
    ["forma_pagamento", "Forma de pagamento", "select-payment"],
    ["valor_produtos", "Valor dos produtos", "number"],
    ["valor_frete", "Valor do frete", "number"],
    ["valor_desconto", "Valor do desconto", "number"],
    ["valor_total", "Valor total", "number"],
    ["status_pagamento", "Status do pagamento", "select-status"],
    ["itens_resumo", "Itens comprados", "textarea"],
    ["observacoes", "Observacoes", "textarea"],
  ];
  dom.reviewForm.innerHTML = fields.map(([name, label, type]) => fieldHtml(name, label, type, expense[name])).join("");
  dom.reviewModal.classList.remove("is-hidden");
}

function fieldHtml(name, label, type, value) {
  if (type === "select") {
    return `<label class="field"><span>${label}</span><select name="${name}">${categories.map((category) => `<option ${category === value ? "selected" : ""}>${category}</option>`).join("")}</select></label>`;
  }
  if (type === "select-payment") {
    return `<label class="field"><span>${label}</span><select name="${name}">${paymentMethods.map((method) => `<option ${method === value ? "selected" : ""}>${method}</option>`).join("")}</select></label>`;
  }
  if (type === "select-status") {
    return `<label class="field"><span>${label}</span><select name="${name}"><option ${value === "Pago" ? "selected" : ""}>Pago</option><option ${value === "Pendente" ? "selected" : ""}>Pendente</option></select></label>`;
  }
  if (type === "textarea") {
    return `<label class="field field-full"><span>${label}</span><textarea name="${name}" rows="3">${sanitizeText(value || "")}</textarea></label>`;
  }
  const step = type === "number" ? ' step="0.01" min="0"' : "";
  return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${sanitizeText(value || "")}"${step} /></label>`;
}

function confirmReview() {
  const formData = Object.fromEntries(new FormData(dom.reviewForm).entries());
  const expense = normalizeExpense({ ...pendingReview, ...formData });
  state.expenses = [expense, ...state.expenses.filter((item) => item.id !== expense.id)];
  closeReview();
  clearSelectedImage();
  selectedMonth = new Date(`${expense.data_emissao}T00:00:00`);
  selectedMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
  dom.staleBanner.classList.remove("is-hidden");
  render();
  setView("home");
}

function closeReview() {
  pendingReview = null;
  dom.reviewModal.classList.add("is-hidden");
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
    ["Numero da nota", expense.numero_nota || "-"],
    ["Data da compra", dateBR(expense.data_emissao)],
    ["Data do registro", dateBR(expense.data_registro)],
    ["Data de vencimento", dateBR(expense.data_vencimento)],
    ["Categoria", expense.categoria],
    ["Descricao", expense.descricao],
    ["Forma de pagamento", expense.forma_pagamento],
    ["Valor dos produtos", currency(expense.valor_produtos)],
    ["Frete", currency(expense.valor_frete)],
    ["Desconto", currency(expense.valor_desconto)],
    ["Valor total", currency(expense.valor_total)],
    ["Status", expense.status_pagamento],
    ["Itens comprados", expense.itens_resumo || (expense.itens_json || []).map((item) => item.nome).join(", ") || "-"],
    ["Dica financeira", expense.dica_financeira || "-"],
    ["Alerta financeiro", expense.alerta_financeiro || "-"],
    ["Confianca da leitura", `${Math.round(Number(expense.confianca_leitura || 0) * 100)}%`],
    ["Observacoes", expense.observacoes || "-"],
  ];
  dom.detailContent.innerHTML = items.map(([label, value]) => `<div class="detail-item"><span>${label}</span><strong>${sanitizeText(value)}</strong></div>`).join("");
  dom.detailModal.classList.remove("is-hidden");
}

function updateSelectedStatus(status) {
  const expense = state.expenses.find((item) => item.id === selectedExpenseId);
  if (!expense) return;
  expense.status_pagamento = status;
  saveState();
  openDetail(expense.id);
  render();
}

function shareSelectedExpense() {
  const expense = state.expenses.find((item) => item.id === selectedExpenseId);
  if (!expense) return;
  const text = `${expense.fornecedor || expense.descricao} - ${dateBR(expense.data_emissao)} - ${currency(expense.valor_total)} - ${expense.status_pagamento}`;
  if (navigator.share) navigator.share({ title: "Resumo do gasto", text });
  else navigator.clipboard?.writeText(text);
}

function deleteSelectedExpense() {
  const expense = state.expenses.find((item) => item.id === selectedExpenseId);
  if (!expense) return;
  if (!confirm(`Excluir o gasto "${expense.fornecedor || expense.descricao}"?`)) return;
  state.expenses = state.expenses.filter((item) => item.id !== selectedExpenseId);
  selectedExpenseId = null;
  dom.detailModal.classList.add("is-hidden");
  render();
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
  dom.searchInput.addEventListener("input", renderExpenses);
  dom.showUpload.addEventListener("click", () => toggleAddMode("upload"));
  dom.showManual.addEventListener("click", () => toggleAddMode("manual"));
  dom.receiptInput.addEventListener("change", handleFileSelect);
  dom.removeImage.addEventListener("click", clearSelectedImage);
  dom.sendReceipt.addEventListener("click", sendReceipt);
  dom.manualForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const expense = createExpenseFromForm(dom.manualForm, "Registro manual");
    state.expenses.unshift(expense);
    dom.manualForm.reset();
    selectedMonth = new Date(`${expense.data_emissao}T00:00:00`);
    selectedMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
    render();
    setView("home");
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
  dom.closeDetail.addEventListener("click", () => dom.detailModal.classList.add("is-hidden"));
  dom.markPaid.addEventListener("click", () => updateSelectedStatus("Pago"));
  dom.markPending.addEventListener("click", () => updateSelectedStatus("Pendente"));
  dom.shareExpense.addEventListener("click", shareSelectedExpense);
  dom.deleteExpense.addEventListener("click", deleteSelectedExpense);
  dom.openFilters.addEventListener("click", () => dom.filterDrawer.classList.remove("is-hidden"));
  dom.closeFilters.addEventListener("click", () => dom.filterDrawer.classList.add("is-hidden"));
  dom.clearFilters.addEventListener("click", () => {
    state.filters = structuredClone(defaultState.filters);
    dom.filterForm.reset();
    renderExpenses();
  });
  dom.filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.filters = { ...state.filters, ...Object.fromEntries(new FormData(dom.filterForm).entries()) };
    dom.filterDrawer.classList.add("is-hidden");
    renderExpenses();
  });
  window.addEventListener("resize", () => drawCharts(getStats()));
}

function authenticate() {
  const pin = dom.pinInput.value.trim();
  if (pin.length < 4) {
    dom.authMessage.textContent = "Informe um PIN com pelo menos 4 digitos.";
    return;
  }
  const savedPin = localStorage.getItem(pinKey);
  if (savedPin && savedPin !== pin) {
    dom.authMessage.textContent = "PIN incorreto.";
    return;
  }
  if (!savedPin) localStorage.setItem(pinKey, pin);
  localStorage.setItem(authSessionKey, JSON.stringify({ unlockedAt: Date.now() }));
  unlockApp();
}

function unlockApp() {
  dom.authScreen.classList.add("is-hidden");
  dom.appShell.classList.remove("is-hidden");
  render();
}

function hasActiveAuthSession() {
  const savedPin = localStorage.getItem(pinKey);
  if (!savedPin) return false;
  const savedSession = parseJson(localStorage.getItem(authSessionKey), null);
  if (!savedSession?.unlockedAt) return false;
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  return Date.now() - Number(savedSession.unlockedAt) < thirtyDays;
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
  const categoryLimits = {};
  categories.forEach((category) => {
    const value = data[`limit_${category}`];
    if (value) categoryLimits[category] = Number(value);
  });
  state.settings = {
    monthlyLimit: Number(data.monthlyLimit || 0),
    cycleStartDay: Number(data.cycleStartDay || 1),
    savingsGoal: Number(data.savingsGoal || 0),
    webhookUrl: data.webhookUrl || "",
    categoryLimits,
  };
  if (data.webhookUrl) localStorage.setItem("N8N_UPLOAD_WEBHOOK_URL", data.webhookUrl);
  saveState();
  render();
}

function initForms() {
  populateSelects();
  dom.manualForm.data_emissao.value = new Date().toISOString().slice(0, 10);
  dom.manualForm.status_pagamento.value = "Pago";
  Object.entries(state.filters).forEach(([key, value]) => {
    if (dom.filterForm.elements[key]) dom.filterForm.elements[key].value = value;
  });
}

initForms();
bindEvents();

if (hasActiveAuthSession()) {
  unlockApp();
} else if (localStorage.getItem(pinKey)) {
  dom.authMessage.textContent = "Informe seu PIN para entrar.";
}
