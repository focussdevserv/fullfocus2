import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { register } from "./operacao.js";

function harness() {
  const calls = [];
  const query = async (sql, params) => { calls.push({ sql, params }); if (sql.includes("from contracts")) return { rows: [{ id: 9, organization_id: "org-a", status: "signed", name: "Contrato", client_id: 4, value: 2700 }], rowCount: 1 }; if (sql.startsWith("select")) return { rows: [{ id: 1, organization_id: "org-a", title: "T" }], rowCount: 1 }; return { rows: [{ id: 2, organization_id: "org-a" }], rowCount: 1 }; };
  const pool = { query, connect: async () => ({ query, release() {} }) };
  const app = express(); app.use(express.json());
  register(app, { pool, tenant: (_req) => "org-a", asText: (v) => String(v ?? "").trim(), classifyDbError: (_e, error) => ({ status: 500, error }), validateRelations: async () => {} });
  return { app, calls };
}
async function request(t, method, path, body) { const address = t.server.address(); return fetch(`http://127.0.0.1:${address.port}${path}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }); }
async function withServer(t, fn) { const { app, calls } = harness(); t.server = createServer(app); await new Promise((resolve) => t.server.listen(0, resolve)); t.after(() => t.server.close()); return fn(calls); }

test("files lista apenas pelo tenant", async (t) => withServer(t, async (calls) => { const response = await request(t, "GET", "/api/files"); assert.equal(response.status, 200); assert.equal((await response.json()).files[0].organization_id, "org-a"); assert.equal(calls[0].params[0], "org-a"); assert.match(calls[0].sql, /organization_id=\$1/); }));
test("tickets lista apenas pelo tenant", async (t) => withServer(t, async (calls) => { const response = await request(t, "GET", "/api/tickets"); assert.equal(response.status, 200); assert.equal((await response.json()).tickets.length, 1); assert.equal(calls[0].params[0], "org-a"); }));
test("POST de arquivo válido retorna 201", async (t) => withServer(t, async () => { const response = await request(t, "POST", "/api/files", { name: "Briefing", url: "https://example.com/a.pdf" }); assert.equal(response.status, 201); }));
test("POST de arquivo aceita conteúdo base64 dentro do limite", async (t) => withServer(t, async () => { const response = await request(t, "POST", "/api/files", { name: "Briefing", url: "data:application/pdf;base64,SGVsbG8=" }); assert.equal(response.status, 201); }));
test("POST de arquivo rejeita URL inválida", async (t) => withServer(t, async () => { const response = await request(t, "POST", "/api/files", { name: "Briefing", url: "javascript:alert(1)" }); assert.equal(response.status, 400); }));
test("POST de ticket sem título retorna 400", async (t) => withServer(t, async () => { const response = await request(t, "POST", "/api/tickets", { priority: "urgent" }); assert.equal(response.status, 400); assert.match((await response.json()).error, /título/i); }));
test("POST de projeto rejeita status legado desconhecido", async (t) => withServer(t, async () => { const response = await request(t, "POST", "/api/projects", { name: "Site", status: "unknown" }); assert.equal(response.status, 400); }));
test("GitHub preview rejeita host externo", async (t) => withServer(t, async () => { const response = await request(t, "GET", "/api/projects/github-preview?url=https%3A%2F%2Fexample.com%2Frepo"); assert.equal(response.status, 400); }));
test("GitHub preview agrega linguagens e tópicos", async (t) => withServer(t, async () => {
  const actualFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => String(url).endsWith("/languages")
    ? { ok: true, json: async () => ({ TypeScript: 120, CSS: 40 }) }
    : String(url).includes("api.github.com/repos/")
      ? { ok: true, json: async () => ({ name: "app", html_url: "https://github.com/acme/app", topics: ["saas"], language: "JavaScript", owner: { login: "acme" } }) }
      : actualFetch(url, options);
  try {
    const response = await request(t, "GET", "/api/projects/github-preview?url=https%3A%2F%2Fgithub.com%2Facme%2Fapp");
    const body = await response.json(); assert.equal(response.status, 200); assert.match(body.technologies, /TypeScript/); assert.match(body.technologies, /saas/);
  } finally { globalThis.fetch = actualFetch; }
}));
test("contrato assinado cria projeto vinculado no mesmo tenant", async (t) => withServer(t, async (calls) => { const response = await request(t, "POST", "/api/contracts/9/create-project", {}); const body = await response.json(); assert.equal(response.status, 201, `${JSON.stringify(body)} ${JSON.stringify(calls)}`); assert.equal(body.created, true); assert.ok(calls.every((x) => x.sql === "begin" || x.sql === "commit" || x.sql === "rollback" || x.sql.includes("organization_id"))); }));
test("contratos respeitam filtro de cliente no workspace", async (t) => withServer(t, async (calls) => { const response = await request(t, "GET", "/api/contracts?client_id=4"); assert.equal(response.status, 200); assert.match(calls[0].sql, /c\.client_id=\$2/); assert.deepEqual(calls[0].params, ["org-a", "4"]); }));
test("contrato rejeita proposta que não está aprovada", async (t) => withServer(t, async () => { const response = await request(t, "POST", "/api/contracts", { name: "Contrato", client_id: 4, value: 2700, proposal_id: 7 }); assert.equal(response.status, 400); assert.match((await response.json()).error, /proposta precisa estar aprovada/i); }));
