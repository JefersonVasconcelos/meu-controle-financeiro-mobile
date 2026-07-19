import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { randomUUID } from "node:crypto";

const root = new URL("../", import.meta.url).pathname.replace(/^\/(.:)/, "$1");
const port = 4173;
const user = { id: "11111111-1111-4111-8111-111111111111", email: "teste@example.com" };
const categories = [{ id: "cat-moradia", user_id: user.id, name: "Moradia", icon: "Home", color: "#8b5cf6", sort_order: 1 }];
const accounts = [];
const expenses = [];
const settings = [];

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  response.end(JSON.stringify(body));
}

async function bodyOf(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : null;
}

function rowsFor(pathname) {
  if (pathname.endsWith("/categories")) return categories;
  if (pathname.endsWith("/accounts")) return accounts;
  if (pathname.endsWith("/expenses")) return expenses;
  if (pathname.endsWith("/monthly_settings")) return settings;
  if (pathname.endsWith("/category_limits")) return [];
  return null;
}

function insertRows(target, payload) {
  const incoming = Array.isArray(payload) ? payload : [payload];
  const created = incoming.map((row) => ({ id: randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...row }));
  target.push(...created);
  return created;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${port}`);
  if (request.method === "OPTIONS") return json(response, 200, {});
  if (url.pathname === "/api/config") return json(response, 200, { supabaseUrl: `http://127.0.0.1:${port}`, supabasePublishableKey: "sb_publishable_mock" });
  if (url.pathname === "/auth/v1/token" && request.method === "POST") return json(response, 200, { access_token: "mock-access", refresh_token: "mock-refresh", expires_in: 3600, user });
  if (url.pathname === "/auth/v1/signup" && request.method === "POST") return json(response, 200, { access_token: "mock-access", refresh_token: "mock-refresh", expires_in: 3600, user });
  if (url.pathname === "/auth/v1/user") return json(response, 200, user);
  if (url.pathname === "/auth/v1/logout") return json(response, 204, null);

  if (url.pathname.startsWith("/rest/v1/")) {
    const target = rowsFor(url.pathname);
    if (!target) return json(response, 404, { message: "Tabela não encontrada" });
    if (request.method === "GET") {
      if (url.pathname.endsWith("/monthly_settings")) {
        const year = Number(url.searchParams.get("year")?.replace("eq.", ""));
        const month = Number(url.searchParams.get("month")?.replace("eq.", ""));
        return json(response, 200, target.filter((row) => row.year === year && row.month === month));
      }
      return json(response, 200, [...target].reverse());
    }
    if (request.method === "POST") {
      const payload = await bodyOf(request);
      if (url.pathname.endsWith("/monthly_settings") && url.searchParams.has("on_conflict")) {
        const found = target.find((row) => row.user_id === payload.user_id && row.year === payload.year && row.month === payload.month);
        if (found) Object.assign(found, payload);
        else insertRows(target, payload);
        return json(response, 201, found ? [found] : [target.at(-1)]);
      }
      return json(response, 201, insertRows(target, payload));
    }
    if (request.method === "DELETE" && url.pathname.endsWith("/expenses")) {
      const id = url.searchParams.get("id")?.replace("eq.", "");
      const index = target.findIndex((row) => row.id === id);
      if (index >= 0) target.splice(index, 1);
      response.writeHead(204);
      return response.end();
    }
  }

  const requested = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const safe = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, "");
  try {
    const bytes = await readFile(join(root, safe));
    const type = ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" })[extname(safe)] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": type });
    response.end(bytes);
  } catch {
    json(response, 404, { message: "Arquivo não encontrado" });
  }
});

server.listen(port, "127.0.0.1", () => console.log(`mock-server:${port}`));

export { server };
