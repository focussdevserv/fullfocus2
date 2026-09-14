import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { register } from "./inbox.js";

const ORG = "00000000-0000-0000-0000-000000000001";
function setup() {
  const calls = [];
  const pool = { query: async (sql, params) => { calls.push({ sql, params });
    if (sql.startsWith("select c.*")) return { rows: [{ id: 1, organization_id: ORG, subject: "Ajuda", status: params[1], unread_count: 2 }], rowCount: 1 };
    if (sql.startsWith("insert into conversations")) return { rows: [{ id: 4, organization_id: ORG, subject: params[1] }], rowCount: 1 };
    if (sql.startsWith("update conversations")) return { rows: [{ id: params[1], status: params[0], unread_count: 0 }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  } };
  const app = express(); app.use(express.json());
  register(app, { pool, tenant: (_req, res) => { res.locals.org = ORG; return ORG; }, asText: (v) => typeof v === "string" ? v.trim() : "", classifyDbError: (_e, fallback) => ({ status: 503, error: fallback }) });
  const server = createServer(app); return { server, calls };
}
async function request(t, path, options = {}) { await new Promise((resolve) => t.server.listen(0, resolve)); const port = t.server.address().port; const response = await fetch(`http://127.0.0.1:${port}${path}`, { ...options, headers: { "content-type": "application/json" }, body: options.body ? JSON.stringify(options.body) : undefined }); t.server.close(); return response; }

test("lista filtra por organização e status", async () => { const t = setup(); const response = await request(t, "/api/conversations?status=archived"); assert.equal(response.status, 200); assert.deepEqual(t.calls[0].params, [ORG, "archived"]); });
test("POST conversa válida responde 201", async () => { const t = setup(); const response = await request(t, "/api/conversations", { method: "POST", body: { subject: "Novo assunto", channel: "internal" } }); assert.equal(response.status, 201); });
test("POST mensagem vazia responde 400", async () => { const t = setup(); const response = await request(t, "/api/conversations/1/messages", { method: "POST", body: { body: "   " } }); assert.equal(response.status, 400); });
test("PATCH read zera unread", async () => { const t = setup(); const response = await request(t, "/api/conversations/1", { method: "PATCH", body: { status: "open", read: true } }); assert.equal(response.status, 200); assert.equal(t.calls[0].params[3], true); });
