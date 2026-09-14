import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { register } from "./automacoes.js";

test("provedor sem teste real não é reportado como conectado", async (t) => {
  const pool = { query: async (sql) => sql.includes("select *") ? { rows: [{ organization_id: "org", provider: "github", config: {} }], rowCount: 1 } : { rows: [], rowCount: 0 } };
  const app = express(); app.use(express.json()); register(app, { pool, tenant: () => "org", asText: (value) => String(value ?? ""), classifyDbError: (_error, message) => ({ status: 500, error: message }) });
  const server = createServer(app); await new Promise((resolve) => server.listen(0, resolve)); t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/integrations/1/test`, { method: "POST" });
  assert.equal(response.status, 409);
});
