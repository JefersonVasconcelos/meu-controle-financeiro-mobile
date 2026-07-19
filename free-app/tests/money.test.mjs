import test from "node:test";
import assert from "node:assert/strict";
import { formatBRL, parseBRL, toCents } from "../money.js";

test("interpreta valores brasileiros e internacionais sem perder centavos", () => {
  assert.equal(parseBRL("2700,00"), 2700);
  assert.equal(parseBRL("2.700,00"), 2700);
  assert.equal(parseBRL("R$ 2.700,50"), 2700.5);
  assert.equal(parseBRL("2700.00"), 2700);
  assert.equal(parseBRL("1.234"), 1234);
  assert.equal(parseBRL("12,34"), 12.34);
  assert.ok(Number.isNaN(parseBRL("")));
});

test("formata BRL e converte em centavos", () => {
  assert.equal(formatBRL(2700), "R$ 2.700,00");
  assert.equal(toCents("342,65"), 34265);
});
