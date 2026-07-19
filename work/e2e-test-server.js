const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const staticDir = path.join(root, "outputs", "controle-financeiro-mobile");
const port = Number(process.env.MCF_E2E_PORT || 41731);
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
};

let state = null;
let revision = 0;
let updatedAt = null;
const history = [];
const audit = [];

function sendJson(response, payload, status = 200) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1000000) reject(new Error("body too large"));
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === "/api/health") return sendJson(response, { status: "ok", storage: true });
  if (url.pathname === "/api/state" && request.method === "GET") {
    return sendJson(response, { state, revision, updatedAt, user: { email: "teste-local@example.com", name: "Teste local" } });
  }
  if (url.pathname === "/api/state" && request.method === "PUT") {
    const body = JSON.parse(await readBody(request));
    if (Number(body.expectedRevision) !== revision) {
      return sendJson(response, { state, revision, updatedAt, error: "Conflito de teste." }, 409);
    }
    if (state) history.unshift({ revision, created_at: updatedAt });
    state = body.state;
    revision += 1;
    updatedAt = new Date().toISOString();
    audit.unshift({ id: `audit-${revision}`, eventType: "state_updated", metadata: { revision }, createdAt: updatedAt });
    return sendJson(response, { state, revision, updatedAt, user: { email: "teste-local@example.com", name: "Teste local" } });
  }
  if (url.pathname === "/api/history" && request.method === "GET") return sendJson(response, { items: history.slice(0, 20) });
  if (url.pathname === "/api/audit" && request.method === "GET") return sendJson(response, { items: audit.slice(0, 50) });
  if (url.pathname === "/api/client-error" && request.method === "POST") return sendJson(response, { received: true }, 202);
  if (url.pathname === "/api/account-data" && request.method === "DELETE") {
    state = null;
    revision = 0;
    updatedAt = null;
    history.length = 0;
    audit.length = 0;
    return sendJson(response, { deleted: true });
  }
  if (url.pathname === "/api/account-data/remove-demo" && request.method === "POST") {
    return sendJson(response, { state, revision, updatedAt, changed: false, summary: { preservedExpenses: state?.expenses?.length || 0 }, user: { email: "teste-local@example.com" } });
  }
  if (url.pathname.startsWith("/api/")) return sendJson(response, { error: "Rota de teste não encontrada." }, 404);

  const relative = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const filePath = path.resolve(staticDir, relative);
  if (!filePath.startsWith(staticDir) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    return response.end("Not found");
  }
  response.writeHead(200, { "content-type": contentTypes[path.extname(filePath)] || "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(filePath).pipe(response);
});

server.listen(port, "127.0.0.1", () => process.stdout.write(`E2E_READY http://127.0.0.1:${port}\n`));

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

module.exports = { server };
