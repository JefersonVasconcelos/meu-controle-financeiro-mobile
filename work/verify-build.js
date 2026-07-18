const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "outputs", "controle-financeiro-mobile");
const staticDir = path.join(root, "dist", "static");
const files = ["app.js", "index.html", "styles.css", "service-worker.js", "manifest.webmanifest", "icon.svg", "og.png", "og-phase2.png", "og-phase3-secure.png", "og-phase4-intelligence.png"];

for (const file of files) {
  const source = fs.readFileSync(path.join(sourceDir, file));
  const built = fs.readFileSync(path.join(staticDir, file));
  if (!source.equals(built)) throw new Error(`${file} differs between source and dist/static`);
}

const html = fs.readFileSync(path.join(sourceDir, "index.html"), "utf8");
const ids = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicateIds.length) throw new Error(`Duplicate ids: ${duplicateIds.join(", ")}`);

const app = fs.readFileSync(path.join(sourceDir, "app.js"), "utf8");
const selectors = [...app.matchAll(/querySelector\("#([^"]+)"\)/g)].map((match) => match[1]);
const missingIds = [...new Set(selectors.filter((id) => !ids.includes(id)))];
if (missingIds.length) throw new Error(`Missing ids: ${missingIds.join(", ")}`);

const server = fs.readFileSync(path.join(root, "dist", "server", "index.js"), "utf8");
if (!server.includes("content-security-policy")) throw new Error("Security headers are missing");
if (server.includes("script-src 'self' 'unsafe-inline'")) throw new Error("Inline scripts remain allowed");
if (!server.includes("controle-financeiro-mobile-v10")) throw new Error("Updated service worker is missing from server bundle");
if (!server.includes("oai-authenticated-user-email")) throw new Error("Authenticated cloud ownership check is missing");
if (!server.includes("expectedRevision")) throw new Error("Cloud conflict protection is missing");
if (!server.includes('"/og.png"')) throw new Error("Social preview image is missing");
if (!server.includes('"/og-phase2.png"')) throw new Error("Phase 2 social preview image is missing");
if (!server.includes('"/og-phase3-secure.png"')) throw new Error("Phase 3 social preview image is missing");
if (!server.includes('"/og-phase4-intelligence.png"')) throw new Error("Phase 4 social preview image is missing");

const hosting = JSON.parse(fs.readFileSync(path.join(root, "dist", ".openai", "hosting.json"), "utf8"));
if (hosting.d1 !== "DB" || hosting.r2 !== null) throw new Error("D1/R2 bindings are not configured as expected");
if (!fs.existsSync(path.join(root, "dist", ".openai", "drizzle", "0000_phase2_cloud_state.sql"))) {
  throw new Error("D1 migration is missing from the deployment build");
}
if (!fs.existsSync(path.join(root, "dist", ".openai", "drizzle", "0001_phase3_audit_recovery.sql"))) {
  throw new Error("Phase 3 audit and recovery migration is missing from the deployment build");
}

console.log("Build, HTML selector, and security checks passed.");
