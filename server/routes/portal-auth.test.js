import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import { createServer } from "node:http";
import { registerPortalAuthRoutes, createPortalAccessGuard } from "./portal-auth.js";

const password = "SenhaPortal123";
const hashPassword = (value) => { const salt = "fixed-salt"; return { salt, hash: crypto.scryptSync(value, salt, 64).toString("hex") }; };
const verifyPassword = (value, salt, expected) => crypto.scryptSync(value, salt, 64).toString("hex") === expected;
async function request(server, path, options = {}) { const address = server.address(); return fetch(`http://127.0.0.1:${address.port}${path}`, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) }, body: options.body === undefined ? undefined : JSON.stringify(options.body) }); }

test("login do portal cria cookie separado da sessão administrativa", async (t) => {
  const calls = [], credentials = hashPassword(password);
  const pool = { query: async (sql, params) => { calls.push({ sql, params }); if (sql.startsWith("select id,client_id,organization_id,password_salt")) return { rowCount: 1, rows: [{ id: 9, client_id: 4, organization_id: "org", password_salt: credentials.salt, password_hash: credentials.hash }] }; return { rowCount: 1, rows: [] }; } };
  const app = express(); app.use(express.json()); registerPortalAuthRoutes(app, { pool, hashPassword, verifyPassword });
  const server = createServer(app); await new Promise((resolve) => server.listen(0, resolve)); t.after(() => server.close());
  const response = await request(server, "/api/portal/token/login", { method: "POST", body: { email: "cliente@example.com", password } });
  assert.equal(response.status, 200); assert.match(response.headers.get("set-cookie"), /focus_portal_session=/); assert.ok(!response.headers.get("set-cookie").includes("focus_session="));
  assert.ok(calls.some((call) => call.sql.startsWith("update client_portal_links set last_login_at")));
});

test("guard exige autenticação somente quando o link está configurado", async (t) => {
  const app = express(); app.use(express.json());
  const pool = { query: async (sql) => sql.startsWith("select id,client_id,organization_id,portal_auth_enabled") ? { rowCount: 1, rows: [{ id: 9, client_id: 4, organization_id: "org", portal_auth_enabled: true }] } : { rowCount: 0, rows: [] } };
  app.use("/api/portal/:token", createPortalAccessGuard({ pool })); app.get("/api/portal/:token", (_req, res) => res.json({ ok: true }));
  const server = createServer(app); await new Promise((resolve) => server.listen(0, resolve)); t.after(() => server.close());
  const response = await request(server, "/api/portal/token", { headers: { accept: "application/json" } });
  assert.equal(response.status, 401); assert.equal((await response.json()).error, "Autenticação do portal necessária.");
});
