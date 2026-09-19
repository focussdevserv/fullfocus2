import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { registerContractPublicRoutes } from "./contract-public.js";

const org = "00000000-0000-0000-0000-000000000001";
async function request(server, path, options = {}) { const address = server.address(); return fetch(`http://127.0.0.1:${address.port}${path}`, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) }, body: options.body === undefined ? undefined : JSON.stringify(options.body) }); }

function setup() {
  const calls = [];
  const state = { contract: { id: 7, organization_id: org, client_id: 3, name: "Contrato Site", status: "awaiting_signature", value: 1200, project_id: null, public_token_hash: "secret", signature_data: { ip: "127.0.0.1" }, audit_log: ["internal"] }, project: null };
  const query = async (sql, params) => {
    calls.push({ sql, params });
    if (["begin", "commit", "rollback"].includes(sql)) return { rowCount: 0, rows: [] };
    if (sql.startsWith("select c.id")) return { rowCount: 1, rows: [{ ...state.contract, client_name: "Cliente" }] };
    if (sql.startsWith("select * from contracts where public_token_hash")) return { rowCount: 1, rows: [{ ...state.contract }] };
    if (sql.startsWith("update contracts set status='signed'")) { state.contract = { ...state.contract, status: "signed", signature_data: JSON.parse(params[0]) }; return { rowCount: 1, rows: [{ ...state.contract }] }; }
    if (sql.startsWith("select * from projects")) return { rowCount: state.project ? 1 : 0, rows: state.project ? [{ ...state.project }] : [] };
    if (sql.startsWith("insert into projects")) { state.project = { id: 11, organization_id: org, contract_id: 7, client_id: 3, name: "Contrato Site", status: "planning", observations: "internal", access_storage_reference: "vault://secret" }; return { rowCount: 1, rows: [{ ...state.project }] }; }
    if (sql.startsWith("update contracts set project_id")) { state.contract.project_id = params[0]; return { rowCount: 1, rows: [{ ...state.contract }] }; }
    return { rowCount: 1, rows: [{ ...state.contract }] };
  };
  let lockTail = Promise.resolve();
  const pool = { query, connect: async () => {
    let unlock = null;
    return { query: async (sql, params) => {
      if (sql.startsWith("select * from contracts where public_token_hash")) {
        const previous = lockTail;
        lockTail = new Promise((resolve) => { unlock = resolve; });
        await previous;
      }
      const result = await query(sql, params);
      if ((sql === "commit" || sql === "rollback") && unlock) { unlock(); unlock = null; }
      return result;
    }, release() { unlock?.(); } };
  } };
  const app = express(); app.use(express.json()); app.use((req, _res, next) => { req.user = { id: 1, organization_id: org }; next(); });
  registerContractPublicRoutes(app, { pool, tenant: () => org, requireAuth: (_req, _res, next) => next(), classifyDbError: (_error, fallback) => ({ status: 500, error: fallback }) });
  return { app, calls };
}

test("aceite público exige concordância", async (t) => { const { app } = setup(), server = createServer(app); await new Promise((resolve) => server.listen(0, resolve)); t.after(() => server.close()); const response = await request(server, "/api/contracts/public/token/sign", { method: "POST", body: { name: "Cliente", email: "cliente@example.com", accepted_terms: false } }); assert.equal(response.status, 400); });

test("aceite público concorrente cria um projeto, reaproveita no replay e devolve DTO mínimo", async (t) => {
  const { app, calls } = setup(), server = createServer(app); await new Promise((resolve) => server.listen(0, resolve)); t.after(() => server.close());
  const options = { method: "POST", body: { name: "Cliente", document: "123", email: "cliente@example.com", accepted_terms: true } };
  const responses = await Promise.all([request(server, "/api/contracts/public/token/sign", options), request(server, "/api/contracts/public/token/sign", options)]);
  const bodies = await Promise.all(responses.map((response) => response.json()));
  assert.ok(responses.every((response) => response.status === 200));
  assert.deepEqual(bodies.map((body) => body.project_created).sort(), [false, true]);
  assert.deepEqual(bodies.map((body) => body.replayed).sort(), [false, true]);
  for (const body of bodies) {
    assert.deepEqual(Object.keys(body).sort(), ["contract", "project", "project_created", "replayed", "signed"]);
    assert.deepEqual(Object.keys(body.contract).sort(), ["id", "status"]);
    assert.deepEqual(Object.keys(body.project).sort(), ["id", "name", "status"]);
    assert.doesNotMatch(JSON.stringify(body), /public_token_hash|signature_data|organization_id|client_id|audit|access_storage_reference|observations/);
  }
  assert.equal(calls.filter((call) => call.sql.startsWith("insert into projects")).length, 1);
  assert.equal(calls.filter((call) => call.sql.includes("for update")).length, 2);
  assert.ok(calls.some((call) => call.sql.includes("status='signed'") && call.params[1] === 7 && call.params[2] === org));
});

test("consulta pública usa allowlist e nunca expõe campos internos retornados pelo banco", async (t) => {
  const { app } = setup(), server = createServer(app); await new Promise((resolve) => server.listen(0, resolve)); t.after(() => server.close());
  const response = await request(server, "/api/contracts/public/token"), body = await response.json();
  assert.equal(response.status, 200);
  assert.doesNotMatch(JSON.stringify(body), /public_token_hash|signature_data|organization_id|client_id|audit_log/);
  assert.equal(body.contract.id, 7); assert.equal(body.contract.name, "Contrato Site");
});
