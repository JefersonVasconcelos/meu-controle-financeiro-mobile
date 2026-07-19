import test from "node:test";
import assert from "node:assert/strict";
import {
  expenseFingerprint,
  mapLegacyExpense,
  normalizeDate,
  normalizeText,
} from "../data-utils.js";

test("normaliza texto e datas usadas no backup", () => {
  assert.equal(normalizeText("  Alimentação  "), "alimentacao");
  assert.equal(normalizeDate("2026-07-19T10:00:00Z"), "2026-07-19");
  assert.equal(normalizeDate("19/07/2026"), "2026-07-19");
});

test("mapeia gasto do backup do Sites para o Supabase", () => {
  const categories = new Map([["moradia", "cat-1"]]);
  const mapped = mapLegacyExpense({
    descricao: "Aluguel",
    valor_total: "900,00",
    data_emissao: "19/07/2026",
    categoria: "Moradia",
    forma_pagamento: "PIX",
    status_pagamento: "Pago",
  }, categories);
  assert.deepEqual(mapped, {
    description: "Aluguel",
    amount: 900,
    expense_date: "2026-07-19",
    payment_method: "pix",
    is_paid: true,
    category_id: "cat-1",
    account_id: null,
    notes: null,
  });
});

test("detecta duplicado por data, centavos e descrição normalizada", () => {
  const a = expenseFingerprint({ expense_date: "2026-07-19", amount: 10.5, description: "Café" });
  const b = expenseFingerprint({ expense_date: "2026-07-19", amount: "10,50", description: " cafe " });
  assert.equal(a, b);
});
