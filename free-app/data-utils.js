import { parseBRL, toCents } from "./money.js";

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeDate(value) {
  const text = String(value ?? "").trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const brazilian = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brazilian) return `${brazilian[3]}-${brazilian[2]}-${brazilian[1]}`;
  return null;
}

export function mapPaymentMethod(value) {
  const text = normalizeText(value);
  if (text.includes("pix")) return "pix";
  if (text.includes("deb")) return "debito";
  if (text.includes("cred")) return "credito";
  if (text.includes("dinheiro") || text.includes("especie")) return "dinheiro";
  if (text.includes("boleto")) return "boleto";
  return "outro";
}

export function mapPaidStatus(value) {
  if (typeof value === "boolean") return value;
  const text = normalizeText(value);
  if (!text) return true;
  return !(text.includes("pendente") || text.includes("nao pago") || text.includes("em aberto") || text.includes("vencido"));
}

export function expenseFingerprint(expense) {
  return [
    normalizeDate(expense.expense_date) ?? "",
    toCents(expense.amount),
    normalizeText(expense.description),
  ].join("|");
}

export function mapLegacyExpense(raw, categoriesByName, accountIds = new Map()) {
  const amount = parseBRL(raw?.valor_total ?? raw?.amount ?? raw?.valor ?? raw?.value);
  const expenseDate = normalizeDate(raw?.data_emissao ?? raw?.data_registro ?? raw?.expense_date ?? raw?.date);
  const description = String(raw?.descricao ?? raw?.description ?? raw?.fornecedor ?? "Gasto importado").trim();
  if (!Number.isFinite(amount) || amount <= 0 || !expenseDate || !description) return null;

  const categoryName = normalizeText(raw?.categoria ?? raw?.category);
  const categoryId = categoriesByName.get(categoryName) ?? null;
  const legacyAccountId = String(raw?.account_id ?? raw?.accountId ?? "");
  const accountId = accountIds.get(legacyAccountId) ?? null;
  const notes = String(raw?.observacoes ?? raw?.notes ?? "").trim();

  return {
    description: description.slice(0, 120),
    amount,
    expense_date: expenseDate,
    payment_method: mapPaymentMethod(raw?.forma_pagamento ?? raw?.payment_method),
    is_paid: mapPaidStatus(raw?.status_pagamento ?? raw?.is_paid),
    category_id: categoryId,
    account_id: accountId,
    notes: notes ? notes.slice(0, 500) : null,
  };
}

export function mapLegacyAccount(raw) {
  const name = String(raw?.name ?? raw?.nome ?? raw?.bank_name ?? raw?.instituicao ?? "").trim();
  const balance = parseBRL(raw?.opening_balance ?? raw?.saldo_inicial ?? raw?.balance ?? raw?.saldo ?? 0);
  if (!name || !Number.isFinite(balance)) return null;
  return {
    legacyId: String(raw?.id ?? raw?.account_id ?? ""),
    name: name.slice(0, 80),
    type: String(raw?.type ?? raw?.tipo ?? "outro").slice(0, 40),
    opening_balance: balance,
    include_net_worth: raw?.include_net_worth ?? raw?.incluir_patrimonio ?? true,
  };
}

export function isMissingDatabaseObject(error, objectName = "") {
  const code = String(error?.code ?? "");
  const message = normalizeText(error?.message ?? error);
  return code === "42P01" || code === "42703" || code === "PGRST204" || code === "PGRST205" ||
    (message.includes("does not exist") && (!objectName || message.includes(normalizeText(objectName))));
}
