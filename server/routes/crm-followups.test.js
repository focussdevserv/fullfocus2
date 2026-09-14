import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { registerCrmFollowupRoutes } from "./crm-followups.js";

async function request(server, path, options = {}) { const address = server.address(); return fetch(`http://127.0.0.1:${address.port}${path}`, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) }, body: options.body === undefined ? undefined : JSON.stringify(options.body) }); }
function setup() { const calls = []; const pool = { query: async (sql, params) => { calls.push({ sql, params }); if (sql.startsWith("insert into followups")) return { rowCount: 1, rows: [{ id: 5, client_id: params[2], opportunity_id: params[3] }] }; return { rowCount: 1, rows: [] }; } }; const app = express(); app.use(express.json()); registerCrmFollowupRoutes(app, { pool, tenant: () => "org", validateRelations: async () => {}, classifyDbError: (_e, message) => ({ status: 503, error: message }) }); return { app, calls }; }

test("cria follow-up ligado diretamente ao cliente", async (t) => { const { app, calls } = setup(), server = createServer(app); await new Promise((resolve) => server.listen(0, resolve)); t.after(() => server.close()); const response = await request(server, "/api/followups", { method: "POST", body: { client_id: 4, due_at: "2026-09-20T14:00:00Z", channel: "whatsapp", next_action: "Enviar proposta" } }); assert.equal(response.status, 201); const insert = calls.find((call) => call.sql.startsWith("insert into followups")); assert.equal(insert.params[0], "org"); assert.equal(insert.params[2], 4); assert.equal(insert.params[3], null); });
test("não cria follow-up sem vínculo comercial", async (t) => { const { app } = setup(), server = createServer(app); await new Promise((resolve) => server.listen(0, resolve)); t.after(() => server.close()); const response = await request(server, "/api/followups", { method: "POST", body: { due_at: "2026-09-20T14:00:00Z" } }); assert.equal(response.status, 400); });
