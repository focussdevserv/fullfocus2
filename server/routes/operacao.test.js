import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { register } from "./operacao.js";

function harness() {
  const calls = [];
  const pool = { query: async (sql, params) => { calls.push({ sql, params }); if (sql.startsWith("select")) return { rows: [{ id: 1, organization_id: params[0], title: "T" }] }; return { rows: [{ id: 2, organization_id: params[0] }], rowCount: 1 }; } };
  const app = express(); app.use(express.json());
  register(app, { pool, tenant: (_req) => "org-a", asText: (v) => String(v ?? "").trim(), classifyDbError: (_e, error) => ({ status: 500, error }), validateRelations: async () => {} });
  return { app, calls };
}
async function request(t, method, path, body) { const address = t.server.address(); return fetch(`http://127.0.0.1:${address.port}${path}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }); }
async function withServer(t, fn) { const { app, calls } = harness(); t.server = createServer(app); await new Promise((resolve) => t.server.listen(0, resolve)); t.after(() => t.server.close()); return fn(calls); }

test("files lista apenas pelo tenant", async (t) => withServer(t, async (calls) => { const response = await request(t, "GET", "/api/files"); assert.equal(response.status, 200); assert.equal((await response.json()).files[0].organization_id, "org-a"); assert.equal(calls[0].params[0], "org-a"); assert.match(calls[0].sql, /organization_id=\$1/); }));
test("tickets lista apenas pelo tenant", async (t) => withServer(t, async (calls) => { const response = await request(t, "GET", "/api/tickets"); assert.equal(response.status, 200); assert.equal((await response.json()).tickets.length, 1); assert.equal(calls[0].params[0], "org-a"); }));
test("POST de arquivo válido retorna 201", async (t) => withServer(t, async () => { const response = await request(t, "POST", "/api/files", { name: "Briefing", url: "https://example.com/a.pdf" }); assert.equal(response.status, 201); }));
test("POST de ticket sem título retorna 400", async (t) => withServer(t, async () => { const response = await request(t, "POST", "/api/tickets", { priority: "urgent" }); assert.equal(response.status, 400); assert.match((await response.json()).error, /título/i); }));
test("POST de projeto rejeita status legado desconhecido", async (t) => withServer(t, async () => { const response = await request(t, "POST", "/api/projects", { name: "Site", status: "unknown" }); assert.equal(response.status, 400); }));
test("GitHub preview rejeita host externo", async (t) => withServer(t, async () => { const response = await request(t, "GET", "/api/projects/github-preview?url=https%3A%2F%2Fexample.com%2Frepo"); assert.equal(response.status, 400); }));
