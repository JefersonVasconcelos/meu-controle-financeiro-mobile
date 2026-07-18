const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "outputs", "controle-financeiro-mobile");
const staticDir = path.join(root, "dist", "static");
const serverDir = path.join(root, "dist", "server");
const hostingDir = path.join(root, "dist", ".openai");
const fileTypes = {
  "index.html": "text/html; charset=utf-8",
  "styles.css": "text/css; charset=utf-8",
  "app.js": "application/javascript; charset=utf-8",
  "manifest.webmanifest": "application/manifest+json; charset=utf-8",
  "service-worker.js": "application/javascript; charset=utf-8",
  "icon.svg": "image/svg+xml; charset=utf-8",
  "og.png": "image/png",
  "og-phase2.png": "image/png",
};

fs.mkdirSync(staticDir, { recursive: true });
fs.mkdirSync(serverDir, { recursive: true });
fs.mkdirSync(hostingDir, { recursive: true });

const assets = {};
for (const [fileName, type] of Object.entries(fileTypes)) {
  const binary = type === "image/png";
  const body = fs.readFileSync(path.join(sourceDir, fileName), binary ? undefined : "utf8");
  if (binary) fs.copyFileSync(path.join(sourceDir, fileName), path.join(staticDir, fileName));
  else fs.writeFileSync(path.join(staticDir, fileName), body, "utf8");
  assets[`/${fileName}`] = binary ? { type, bodyBase64: body.toString("base64") } : { type, body };
}

const serverSource = `const assets = ${JSON.stringify(assets)};
const schemaSql = \`CREATE TABLE IF NOT EXISTS finance_state (
  owner_email TEXT PRIMARY KEY NOT NULL,
  state_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
)\`;
const categories = ${JSON.stringify(["Alimentação", "Mercado", "Transporte", "Moradia", "Saúde", "Educação", "Lazer", "Assinaturas", "Compras", "Serviços", "Impostos", "Equipamentos", "Outros"])};
const paymentMethods = ${JSON.stringify(["Pix", "Cartão de crédito", "Cartão de débito", "Dinheiro", "Boleto", "Transferência"])};
let schemaPromise;

function responseHeaders(contentType, cacheControl = 'no-store') {
  return {
    'content-type': contentType,
    'cache-control': cacheControl,
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' https:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; worker-src 'self'",
    'permissions-policy': 'camera=(self), microphone=(), geolocation=()',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff'
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: responseHeaders('application/json; charset=utf-8') });
}

function getUser(request) {
  const email = cleanText(request.headers.get('oai-authenticated-user-email'), 320).toLowerCase();
  if (!email || !email.includes('@')) return null;
  let name = '';
  if (request.headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8') {
    try { name = cleanText(decodeURIComponent(request.headers.get('oai-authenticated-user-full-name') || ''), 160); } catch {}
  }
  return { email, name };
}

async function ensureSchema(env) {
  if (!env.DB) throw new Error('Banco de dados indisponível.');
  schemaPromise ||= env.DB.prepare(schemaSql).run();
  await schemaPromise;
}

function cleanText(value, max = 500) {
  return String(value ?? '').replace(/\\0/g, '').trim().slice(0, max);
}

function number(value, max = 1000000000000) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(0, parsed)) : 0;
}

function signedNumber(value, max = 1000000000000) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(-max, parsed)) : 0;
}

function date(value) {
  const text = cleanText(value, 10);
  return /^\\d{4}-\\d{2}-\\d{2}$/.test(text) ? text : '';
}

function timestamp(value, fallback = '') {
  const parsed = new Date(String(value || ''));
  return Number.isNaN(parsed.valueOf()) ? fallback : parsed.toISOString();
}

function safeId(value) {
  const id = cleanText(value, 80);
  return /^[a-zA-Z0-9_-]{1,80}$/.test(id) ? id : crypto.randomUUID();
}

function normalizeExpense(input) {
  const source = input && typeof input === 'object' ? input : {};
  const id = safeId(source.id);
  const registrationDate = date(source.data_registro) || date(source.data_emissao) || new Date().toISOString().slice(0, 10);
  const items = Array.isArray(source.itens_json) ? source.itens_json.slice(0, 50).map((item) => ({
    nome: cleanText(item?.nome, 160) || 'Item',
    valor: number(item?.valor)
  })) : [];
  const category = categories.includes(source.categoria) ? source.categoria : 'Outros';
  const payment = paymentMethods.includes(source.forma_pagamento) ? source.forma_pagamento : 'Pix';
  const origin = ['Nota fiscal', 'Registro manual', 'Comprovante'].includes(source.origem) ? source.origem : 'Comprovante';
  return {
    id,
    data_registro: registrationDate,
    fornecedor: cleanText(source.fornecedor, 160),
    cnpj_fornecedor: cleanText(source.cnpj_fornecedor, 32),
    numero_nota: cleanText(source.numero_nota, 80),
    data_emissao: date(source.data_emissao) || registrationDate,
    data_vencimento: date(source.data_vencimento),
    status_vencimento: cleanText(source.status_vencimento, 40),
    categoria: category,
    descricao: cleanText(source.descricao, 240) || cleanText(source.fornecedor, 160) || 'Gasto',
    forma_pagamento: payment,
    valor_produtos: number(source.valor_produtos),
    valor_frete: number(source.valor_frete),
    valor_desconto: number(source.valor_desconto),
    valor_total: number(source.valor_total),
    status_pagamento: source.status_pagamento === 'Pago' ? 'Pago' : 'Pendente',
    itens_json: items,
    dica_financeira: cleanText(source.dica_financeira, 500),
    alerta_financeiro: cleanText(source.alerta_financeiro, 500),
    confianca_leitura: Math.min(1, number(source.confianca_leitura, 1)),
    observacoes: cleanText(source.observacoes, 1000),
    itens_resumo: cleanText(source.itens_resumo, 1000),
    qtd_itens: Math.min(999, Math.round(number(source.qtd_itens, 999))),
    account_id: cleanText(source.account_id, 80),
    card_id: cleanText(source.card_id, 80),
    installment_group: cleanText(source.installment_group, 80),
    installment_number: Math.min(24, Math.max(1, Math.round(number(source.installment_number, 24) || 1))),
    installment_total: Math.min(24, Math.max(1, Math.round(number(source.installment_total, 24) || 1))),
    recurrence_group: cleanText(source.recurrence_group, 80),
    imported: Boolean(source.imported),
    origem: origin,
    updated_at: timestamp(source.updated_at, registrationDate + 'T00:00:00.000Z')
  };
}

function uniqueRecords(records, normalizer) {
  const map = new Map();
  for (const raw of (Array.isArray(records) ? records : []).slice(0, 5000)) {
    const record = normalizer(raw);
    if (!record) continue;
    const current = map.get(record.id);
    if (!current || record.updated_at >= current.updated_at) map.set(record.id, record);
  }
  return [...map.values()];
}

function normalizeAccount(input) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    id: safeId(source.id),
    name: cleanText(source.name, 80) || 'Conta',
    type: ['Conta corrente', 'Conta digital', 'Poupança', 'Carteira', 'Investimento'].includes(source.type) ? source.type : 'Conta corrente',
    openingBalance: signedNumber(source.openingBalance),
    includeNetWorth: source.includeNetWorth !== false,
    updated_at: timestamp(source.updated_at, new Date().toISOString())
  };
}

function normalizeIncome(input) {
  const source = input && typeof input === 'object' ? input : {};
  const amount = number(source.amount);
  if (!amount) return null;
  return {
    id: safeId(source.id), description: cleanText(source.description, 160) || 'Receita', amount,
    date: date(source.date) || new Date().toISOString().slice(0, 10), accountId: cleanText(source.accountId, 80),
    recurrenceGroup: cleanText(source.recurrenceGroup, 80), imported: Boolean(source.imported),
    updated_at: timestamp(source.updated_at, new Date().toISOString())
  };
}

function normalizeTransfer(input) {
  const source = input && typeof input === 'object' ? input : {};
  const amount = number(source.amount);
  const fromAccountId = cleanText(source.fromAccountId, 80);
  const toAccountId = cleanText(source.toAccountId, 80);
  if (!amount || !fromAccountId || !toAccountId || fromAccountId === toAccountId) return null;
  return {
    id: safeId(source.id), description: cleanText(source.description, 160) || 'Transferência', amount,
    date: date(source.date) || new Date().toISOString().slice(0, 10), fromAccountId, toAccountId,
    updated_at: timestamp(source.updated_at, new Date().toISOString())
  };
}

function normalizeCard(input) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    id: safeId(source.id), name: cleanText(source.name, 80) || 'Cartão', accountId: cleanText(source.accountId, 80),
    limit: number(source.limit), closingDay: Math.min(28, Math.max(1, Math.round(number(source.closingDay, 28) || 1))),
    dueDay: Math.min(28, Math.max(1, Math.round(number(source.dueDay, 28) || 1))),
    updated_at: timestamp(source.updated_at, new Date().toISOString())
  };
}

function normalizeState(input) {
  const source = input && typeof input === 'object' ? input : {};
  const settingsSource = source.settings && typeof source.settings === 'object' ? source.settings : {};
  const limits = {};
  if (settingsSource.categoryLimits && typeof settingsSource.categoryLimits === 'object') {
    for (const category of categories) {
      const value = number(settingsSource.categoryLimits[category]);
      if (value) limits[category] = value;
    }
  }
  const tombstoneMap = new Map();
  for (const item of (Array.isArray(source.deletedExpenses) ? source.deletedExpenses : []).slice(0, 5000)) {
    const id = cleanText(item?.id, 80);
    const deletedAt = timestamp(item?.deleted_at);
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || !deletedAt) continue;
    if (!tombstoneMap.has(id) || deletedAt > tombstoneMap.get(id).deleted_at) tombstoneMap.set(id, { id, deleted_at: deletedAt });
  }
  const expenseMap = new Map();
  for (const raw of (Array.isArray(source.expenses) ? source.expenses : []).slice(0, 5000)) {
    const expense = normalizeExpense(raw);
    const current = expenseMap.get(expense.id);
    if (!current || expense.updated_at >= current.updated_at) expenseMap.set(expense.id, expense);
  }
  const expenses = [...expenseMap.values()].filter((expense) => !tombstoneMap.has(expense.id) || tombstoneMap.get(expense.id).deleted_at < expense.updated_at);
  return {
    settings: {
      monthlyLimit: number(settingsSource.monthlyLimit),
      cycleStartDay: Math.min(28, Math.max(1, Math.round(number(settingsSource.cycleStartDay, 28) || 1))),
      savingsGoal: number(settingsSource.savingsGoal),
      monthlyIncome: number(settingsSource.monthlyIncome),
      emergencyReserveCurrent: number(settingsSource.emergencyReserveCurrent),
      emergencyReserveGoal: number(settingsSource.emergencyReserveGoal),
      categoryLimits: limits
    },
    accounts: uniqueRecords(source.accounts, normalizeAccount),
    incomes: uniqueRecords(source.incomes, normalizeIncome),
    transfers: uniqueRecords(source.transfers, normalizeTransfer),
    cards: uniqueRecords(source.cards, normalizeCard),
    expenses,
    deletedExpenses: [...tombstoneMap.values()],
    demoMode: Boolean(source.demoMode) && expenses.every((expense) => expense.id.startsWith('sample-'))
  };
}

function rowPayload(row, user) {
  if (!row) return { state: null, revision: 0, updatedAt: null, user };
  let parsed;
  try { parsed = JSON.parse(row.state_json); } catch { parsed = {}; }
  return { state: normalizeState(parsed), revision: Number(row.revision || 0), updatedAt: row.updated_at, user };
}

async function getState(env, user) {
  await ensureSchema(env);
  const row = await env.DB.prepare('SELECT state_json, revision, updated_at FROM finance_state WHERE owner_email = ?')
    .bind(user.email).first();
  return json(rowPayload(row, user));
}

async function putState(request, env, user) {
  await ensureSchema(env);
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 1000000) return json({ error: 'Dados acima do limite permitido.' }, 413);
  const text = await request.text();
  if (text.length > 1000000) return json({ error: 'Dados acima do limite permitido.' }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return json({ error: 'JSON inválido.' }, 400); }
  const expectedRevision = Number(body.expectedRevision);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) return json({ error: 'Revisão inválida.' }, 400);
  const state = normalizeState(body.state);
  const stateJson = JSON.stringify(state);
  if (stateJson.length > 900000) return json({ error: 'Dados acima do limite permitido.' }, 413);
  const current = await env.DB.prepare('SELECT state_json, revision, updated_at FROM finance_state WHERE owner_email = ?')
    .bind(user.email).first();
  const currentRevision = Number(current?.revision || 0);
  if (currentRevision !== expectedRevision) return json({ ...rowPayload(current, user), error: 'Os dados foram atualizados em outro dispositivo.' }, 409);
  const updatedAt = new Date().toISOString();

  if (!current) {
    try {
      await env.DB.prepare('INSERT INTO finance_state (owner_email, state_json, revision, updated_at) VALUES (?, ?, 1, ?)')
        .bind(user.email, stateJson, updatedAt).run();
      return json({ state, revision: 1, updatedAt, user });
    } catch {
      const conflict = await env.DB.prepare('SELECT state_json, revision, updated_at FROM finance_state WHERE owner_email = ?')
        .bind(user.email).first();
      return json({ ...rowPayload(conflict, user), error: 'Os dados foram atualizados em outro dispositivo.' }, 409);
    }
  }

  const updated = await env.DB.prepare('UPDATE finance_state SET state_json = ?, revision = revision + 1, updated_at = ? WHERE owner_email = ? AND revision = ? RETURNING revision, updated_at')
    .bind(stateJson, updatedAt, user.email, expectedRevision).first();
  if (!updated) {
    const conflict = await env.DB.prepare('SELECT state_json, revision, updated_at FROM finance_state WHERE owner_email = ?')
      .bind(user.email).first();
    return json({ ...rowPayload(conflict, user), error: 'Os dados foram atualizados em outro dispositivo.' }, 409);
  }
  return json({ state, revision: Number(updated.revision), updatedAt: updated.updated_at, user });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const user = getUser(request);
      if (!user) return json({ error: 'Entre com sua conta para sincronizar.' }, 401);
      try {
        if (url.pathname === '/api/state' && request.method === 'GET') return getState(env, user);
        if (url.pathname === '/api/state' && request.method === 'PUT') return putState(request, env, user);
        return json({ error: 'Rota não encontrada.' }, 404);
      } catch (error) {
        return json({ error: cleanText(error?.message, 200) || 'Falha interna na sincronização.' }, 500);
      }
    }
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/' || pathname === '') pathname = '/index.html';
    const asset = assets[pathname] || assets['/index.html'];
    const cacheControl = pathname === '/service-worker.js' ? 'no-cache' : 'public, max-age=300';
    const body = asset.bodyBase64 ? Uint8Array.from(atob(asset.bodyBase64), (character) => character.charCodeAt(0)) : asset.body;
    return new Response(body, { headers: responseHeaders(asset.type, cacheControl) });
  }
};
`;

fs.writeFileSync(path.join(serverDir, "index.js"), serverSource, "utf8");
fs.copyFileSync(path.join(root, ".openai", "hosting.json"), path.join(hostingDir, "hosting.json"));
const drizzleSource = path.join(root, "drizzle");
const drizzleTarget = path.join(hostingDir, "drizzle");
if (fs.existsSync(drizzleSource)) {
  fs.rmSync(drizzleTarget, { recursive: true, force: true });
  fs.cpSync(drizzleSource, drizzleTarget, { recursive: true });
}

console.log(`Built ${Object.keys(assets).length} static assets, API worker, and D1 migration.`);
