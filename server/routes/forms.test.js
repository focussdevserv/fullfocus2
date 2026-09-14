import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { registerFormRoutes } from "./forms.js";

async function call(app, path, user = { role: "owner" }) {
  const server = createServer(app); await new Promise((resolve) => server.listen(0, resolve));
  try { return await fetch(`http://127.0.0.1:${server.address().port}${path}`); } finally { server.close(); }
}

test("respostas de formulário são paginadas e isoladas pelo workspace", async () => {
  const calls = [], app = express();
  app.use((req, _res, next) => { req.user = { role: "owner" }; next(); });
  registerFormRoutes(app, { tenant: () => "org-a", pool: { query: async (sql, params) => { calls.push({ sql, params }); return { rowCount: 1, rows: [{ id: 3, name: "Briefing", responses: [{ nome: "Ana" }, { nome: "Bia" }], submitted_at: "2026-09-14T10:00:00Z" }] }; } } });
  const response = await call(app, "/api/forms/3/responses?limit=1&offset=1"), body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.responses[0].responses.nome, "Ana"); assert.deepEqual(body.pagination, { limit: 1, offset: 1, total: 2, returned: 1 }); assert.deepEqual(calls[0].params, ["3", "org-a"]);
});

test("respostas de formulário não ficam disponíveis para membro comum", async () => {
  const app = express(); app.use((req, _res, next) => { req.user = { role: "member" }; next(); }); registerFormRoutes(app, { tenant: () => "org-a", pool: { query: async () => ({ rowCount: 0, rows: [] }) } });
  const response = await call(app, "/api/forms/3/responses", { role: "member" }); assert.equal(response.status, 403);
});
