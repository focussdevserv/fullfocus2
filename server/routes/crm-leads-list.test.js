import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { register } from "./crm.js";

test("lista de leads aplica busca, filtros e paginação no workspace", async (t) => {
  const calls = [];
  const pool = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [{ id: 4, name: "Lead" }], rowCount: 1 }; } };
  const app = express();
  register(app, { pool, tenant: () => "org-a", asText: (value) => String(value ?? "").trim(), classifyDbError: (_error, message) => ({ status: 503, error: message }), validateRelations: async () => {} });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/leads?search=ana&status=qualified&source=whatsapp&owner_id=9&limit=25&offset=50`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.leads.length, 1);
  assert.deepEqual(body.pagination, { limit: 25, offset: 50, returned: 1 });
  assert.match(calls[0].sql, /l\.name ilike/);
  assert.match(calls[0].sql, /l\.status=\$3/);
  assert.match(calls[0].sql, /l\.source=\$4/);
  assert.deepEqual(calls[0].params, ["org-a", "%ana%", "qualified", "whatsapp", "9", 25, 50]);
});
