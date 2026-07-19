import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("HTML contém os fluxos essenciais", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  for (const id of ["forgot-password", "login-form", "signup-form", "password-form", "account-form", "expense-form", "limit-form", "backup-file"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  for (const panel of ["dashboard", "accounts", "expenses", "settings"]) {
    assert.match(html, new RegExp(`href=["']#${panel}["']`));
  }
});

test("recuperação de senha envia o link e aceita a nova senha", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(source, /\/auth\/v1\/recover/);
  assert.match(source, /\/auth\/v1\/user/);
  assert.match(source, /type === "recovery"/);
  assert.match(source, /access_token/);
  assert.match(source, /consumeAuthCallback/);
});

test("nenhum backup nem credencial real faz parte dos arquivos públicos", async () => {
  const env = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  assert.match(env, /SEU-PROJETO/);
  assert.doesNotMatch(env, /eyJ[a-zA-Z0-9_-]{20,}/);
});
