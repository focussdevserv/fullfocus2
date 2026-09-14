import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { registerContractPublicRoutes } from "./contract-public.js";

const org = "00000000-0000-0000-0000-000000000001";
async function request(server, path, options = {}) { const address = server.address(); return fetch(`http://127.0.0.1:${address.port}${path}`, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) }, body: options.body === undefined ? undefined : JSON.stringify(options.body) }); }
function setup() {
  const calls = [];
  const pool = { query: async (sql, params) => { calls.push({ sql, params }); if (sql.startsWith("select c.id")) return { rowCount: 1, rows: [{ id: 7, name: "Contrato Site", status: "awaiting_signature", client_name: "Cliente" }] }; if (sql.includes("returning id,name,status,signature_data")) return { rowCount: 1, rows: [{ id: 7, name: "Contrato Site", status: "signed", signature_data: JSON.parse(params[0]) }] }; return { rowCount: 1, rows: [{ id: 7, name: "Contrato Site", status: "awaiting_signature" }] }; } };
  const app = express(); app.use(express.json()); app.use((req, _res, next) => { req.user = { id: 1, organization_id: org }; next(); });
  registerContractPublicRoutes(app, { pool, tenant: () => org, requireAuth: (_req, _res, next) => next(), classifyDbError: (_error, fallback) => ({ status: 500, error: fallback }) });
  return { app, calls };
}

test("aceite público exige concordância", async (t) => { const { app } = setup(), server = createServer(app); await new Promise((resolve) => server.listen(0, resolve)); t.after(() => server.close()); const response = await request(server, "/api/contracts/public/token/sign", { method: "POST", body: { name: "Cliente", email: "cliente@example.com", accepted_terms: false } }); assert.equal(response.status, 400); });
test("aceite público registra assinatura sem devolver dados de auditoria", async (t) => { const { app, calls } = setup(), server = createServer(app); await new Promise((resolve) => server.listen(0, resolve)); t.after(() => server.close()); const response = await request(server, "/api/contracts/public/token/sign", { method: "POST", body: { name: "Cliente", document: "123", email: "cliente@example.com", accepted_terms: true } }); const body = await response.json(); assert.equal(response.status, 200); assert.equal(body.signed, true); assert.equal(body.contract.signature_data.ip, undefined); assert.equal(body.contract.signature_data.user_agent, undefined); assert.ok(calls.some((call) => call.sql.includes("status='signed'") && call.params[1].length === 64)); });
