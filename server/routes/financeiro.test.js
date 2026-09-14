import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { register } from "./financeiro.js";

const ORG = "00000000-0000-0000-0000-000000000001";
function setup() {
  const calls = [];
  const pool = { query: async (sql, params) => { calls.push({ sql, params }); if (sql.includes("generate_series")) return { rows: [{ month: "2026-08", revenue: "10", expense: "3", result: "7" }] }; if (sql.startsWith("select s.*")) return { rows: [{ id: 1, organization_id: ORG, plan: "Pro", amount: "20", status: "active" }] }; if (sql.startsWith("insert into subscriptions")) return { rows: [{ id: 2, organization_id: ORG, plan: "Pro", amount: "20" }] }; return { rows: [] }; } };
  const app = express(); app.use(express.json());
  const ctx = { pool, tenant: (_req, res) => { res.locals.org = ORG; return ORG; }, asText: (v) => typeof v === "string" ? v.trim() : "", classifyDbError: (_e, fallback) => ({ status: 503, error: fallback }), validateRelations: async () => {} };
  register(app, ctx); const server = createServer(app);
  return { app, server, calls };
}
async function request(t, path, options = {}) { await new Promise((resolve) => t.server.listen(0, resolve)); const port = t.server.address().port; const response = await fetch(`http://127.0.0.1:${port}${path}`, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) }, body: options.body ? JSON.stringify(options.body) : undefined }); t.server.close(); return response; }

test("pagamento rejeita valor inválido antes da baixa", async () => { const t = setup(); const response = await request(t, "/api/receivables/7/record-payment", { method: "POST", body: { amount: 0 } }); assert.equal(response.status, 400); });

test("summary agrega por mês", async () => { const t = setup(); const response = await request(t, "/api/finance/summary?months=6"); assert.equal(response.status, 200); assert.deepEqual((await response.json()).summary[0], { month: "2026-08", revenue: "10", expense: "3", result: "7" }); });
test("subscriptions filtra por organização", async () => { const t = setup(); const response = await request(t, "/api/subscriptions"); assert.equal(response.status, 200); assert.equal(t.calls.find((x) => x.sql.startsWith("select s.*")).params[0], ORG); });
test("POST subscriptions válido responde 201", async () => { const t = setup(); const response = await request(t, "/api/subscriptions", { method: "POST", body: { plan: "Pro", amount: 20 } }); assert.equal(response.status, 201); });
test("POST subscriptions inválido responde 400", async () => { const t = setup(); const response = await request(t, "/api/subscriptions", { method: "POST", body: { plan: "", amount: -1 } }); assert.equal(response.status, 400); });
