import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { registerAutomationRunRoutes } from "./automation-runs.js";

test("histórico de automação respeita workspace e permite retry de erro", async (t) => { const calls = []; const pool = { query: async (sql, params) => { calls.push({ sql, params }); if (sql.startsWith("delete from automation_runs")) return { rowCount: 1, rows: [{ id: 8 }] }; return { rowCount: 1, rows: [{ id: 8, result: { error: "falha" } }] }; } }; const app = express(); registerAutomationRunRoutes(app, { pool, tenant: () => "org", classifyDbError: (_e, message) => ({ status: 503, error: message }) }); const server = createServer(app); await new Promise((resolve) => server.listen(0, resolve)); t.after(() => server.close()); const response = await fetch(`http://127.0.0.1:${server.address().port}/api/automations/2/runs/8/retry`, { method: "POST" }); assert.equal(response.status, 200); assert.equal((await response.json()).retry_queued, true); assert.equal(calls[0].params[2], "org"); });
