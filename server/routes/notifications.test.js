import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { register } from "./notifications.js";

const ORG = "00000000-0000-0000-0000-000000000001";
function setup() {
  const calls = [];
  const pool = { query: async (sql, params) => { calls.push({ sql, params }); if (sql.startsWith("select id,message")) return { rows: [{ id: 1, message: "Nova tarefa", read_at: null }], rowCount: 1 }; if (sql.startsWith("select count")) return { rows: [{ count: 1 }], rowCount: 1 }; if (sql.startsWith("update notifications")) return { rows: [{ id: 1, read_at: new Date().toISOString() }], rowCount: 1 }; return { rows: [], rowCount: 0 }; } };
  const app = express(); app.use(express.json()); app.use((req, _res, next) => { req.user = { id: "user-1" }; next(); });
  register(app, { pool, tenant: () => ORG, classifyDbError: (_e, fallback) => ({ status: 503, error: fallback }) });
  const server = createServer(app); return { server, calls };
}
async function request(target, path, options = {}) { await new Promise((resolve) => target.server.listen(0, resolve)); const port = target.server.address().port; const response = await fetch(`http://127.0.0.1:${port}${path}`, { ...options, headers: { "content-type": "application/json" }, body: options.body ? JSON.stringify(options.body) : undefined }); target.server.close(); return response; }

test("lista notificações do usuário e retorna contador", async () => { const target = setup(); const response = await request(target, "/api/notifications"); assert.equal(response.status, 200); assert.deepEqual((await response.json()).unread_count, 1); assert.deepEqual(target.calls[0].params, [ORG, "user-1", 30]); });
test("marca notificação como lida respeitando o workspace", async () => { const target = setup(); const response = await request(target, "/api/notifications/1/read", { method: "PATCH" }); assert.equal(response.status, 200); assert.deepEqual(target.calls[0].params, ["1", ORG, "user-1"]); });
