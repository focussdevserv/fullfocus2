import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { registerDeliveryWorkflowRoutes } from "./delivery-workflow.js";

test("publicação de entrega registra snapshot e atualiza status", async (t) => { const calls = []; const pool = { query: async (sql, params) => { calls.push({ sql, params }); if (sql.startsWith("select * from deliveries")) return { rowCount: 1, rows: [{ id: 3, version: "v1", status: "ready", environment: "staging", published_url: "https://example.com" }] }; if (sql.startsWith("update deliveries")) return { rowCount: 1, rows: [{ id: 3, status: "published" }] }; return { rowCount: 1, rows: [] }; } }; const app = express(); registerDeliveryWorkflowRoutes(app, { pool, tenant: () => "org", classifyDbError: (_e, message) => ({ status: 503, error: message }) }); const server = createServer(app); await new Promise((resolve) => server.listen(0, resolve)); t.after(() => server.close()); const response = await fetch(`http://127.0.0.1:${server.address().port}/api/deliveries/3/publish`, { method: "POST" }); assert.equal(response.status, 201); assert.ok(calls.some((call) => call.sql.startsWith("insert into delivery_publication_history"))); });
