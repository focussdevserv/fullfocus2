import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { registerFinanceOverviewRoutes } from "./finance-overview.js";

test("visão financeira agrega métricas do workspace", async (t) => {
  const app = express(); const pool = { query: async (sql) => { if (sql.includes("from revenues")) return { rows: [{ month: "1000" }] }; if (sql.includes("from expenses")) return { rows: [{ month: "300" }] }; if (sql.includes("from receivables")) return { rows: [{ open: "800", overdue: "100" }] }; if (sql.includes("from payables")) return { rows: [{ open: "200", overdue: "50" }] }; if (sql.includes("from bank_accounts")) return { rows: [{ balance: "2500" }] }; return { rows: [{ active: 2, mrr: "900" }] }; } };
  registerFinanceOverviewRoutes(app, { pool, tenant: () => "org", classifyDbError: (_e, message) => ({ status: 503, error: message }) }); const server = createServer(app); await new Promise((resolve) => server.listen(0, resolve)); t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/finance/overview`); const metrics = (await response.json()).metrics;
  assert.equal(response.status, 200); assert.equal(metrics.month_result, 700); assert.equal(metrics.current_balance, 2500); assert.equal(metrics.payables_overdue, 50); assert.equal(metrics.monthly_recurring_revenue, 900);
});
