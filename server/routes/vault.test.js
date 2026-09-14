import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { register } from "./vault.js";

const ORG = "00000000-0000-0000-0000-000000000001";
function setup() {
  const calls = [], store = {};
  const pool = { query: async (sql, params) => { calls.push({ sql, params }); if (sql.startsWith("insert into vault_accesses")) { Object.assign(store, { id: 1, name: params[3], service: params[4], client_id: null, project_id: null, expires_on: null, secret_ciphertext: params[6], secret_iv: params[7], secret_tag: params[8], created_at: new Date().toISOString(), updated_at: new Date().toISOString() }); return { rows: [store], rowCount: 1 }; } if (sql.startsWith("select password_hash")) return { rows: [{ password_hash: "salt:hash" }], rowCount: 1 }; if (sql.startsWith("select * from vault_accesses")) return { rows: [store], rowCount: 1 }; if (sql.startsWith("select id from")) return { rows: [], rowCount: 0 }; return { rows: [], rowCount: 0 }; } };
  const app = express(); app.use(express.json()); app.use((req, _res, next) => { req.user = { id: "user-1" }; next(); });
  register(app, { pool, tenant: () => ORG, verifyPassword: (value) => value === "secret", classifyDbError: (_e, fallback) => ({ status: 503, error: fallback }) });
  const server = createServer(app); return { server, calls, store };
}
async function request(target, path, options = {}) { await new Promise((resolve) => target.server.listen(0, resolve)); const port = target.server.address().port; const response = await fetch(`http://127.0.0.1:${port}${path}`, { ...options, headers: { "content-type": "application/json" }, body: options.body ? JSON.stringify(options.body) : undefined }); target.server.close(); return response; }

test("cria acesso sem persistir segredo em texto claro e revela somente com confirmação", async () => { const target = setup(); const created = await request(target, "/api/vault", { method: "POST", body: { name: "Produção", service: "GitHub", username: "deploy", password: "secret-value", api_key: "token-value" } }); assert.equal(created.status, 201); assert.equal(JSON.stringify(target.calls.find((call) => call.sql.startsWith("insert into vault_accesses")).params).includes("secret-value"), false); const denied = await request(target, "/api/vault/1/reveal", { method: "POST", body: { confirmation_password: "wrong" } }); assert.equal(denied.status, 401); const revealed = await request(target, "/api/vault/1/reveal", { method: "POST", body: { confirmation_password: "secret" } }); assert.equal(revealed.status, 200); assert.equal((await revealed.json()).secret.password, "secret-value"); });
