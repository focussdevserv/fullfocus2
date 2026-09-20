import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { registerProposalPublicRoutes } from "./proposal-public.js";

const org = "00000000-0000-0000-0000-000000000001";
async function request(server, path, options = {}) { const address = server.address(); return fetch(`http://127.0.0.1:${address.port}${path}`, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) }, body: options.body === undefined ? undefined : JSON.stringify(options.body) }); }
function setup() {
  const calls = [], state = { proposal: { id: 5, title: "Site", status: "sent", organization_id: org, client_id: 12, opportunity_id: 8, lead_id: 9, amount: 100, final_amount: 100, down_payment: 20, installments: 2, installment_amount: 40, payment_method: "pix", scope_included: "Site", notes: "Escopo" }, contracts: [] };
  const result = (rows = []) => ({ rowCount: rows.length, rows });
  const query = async (sql, params = []) => {
    calls.push({ sql, params });
    if (sql === "begin" || sql === "commit" || sql === "rollback") return result();
    if (sql.startsWith("select id,organization_id,client_id")) return result([{ ...state.proposal }]);
    if (sql.startsWith("update proposals set status")) { state.proposal.status = params[0]; return result([{ ...state.proposal }]); }
    if (sql.startsWith("insert into contracts")) {
      if (state.contracts.length) return result();
      const contract = { id: 20, organization_id: org, client_id: state.proposal.client_id, opportunity_id: state.proposal.opportunity_id, proposal_id: state.proposal.id, name: state.proposal.title, status: "draft", value: 100 };
      state.contracts.push(contract); return result([contract]);
    }
    if (sql.startsWith("select * from contracts where organization_id")) return result(state.contracts);
    if (sql.startsWith("update opportunities") || sql.startsWith("update leads") || sql.startsWith("insert into audit_events")) return result([{}]);
    return result([{ ...state.proposal }]);
  };
  const pool = { query, connect: async () => ({ query, release() {} }) };
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, organization_id: org, role: "owner" }; next(); });
  registerProposalPublicRoutes(app, { pool, tenant: () => org, requireAuth: (_req, _res, next) => next(), classifyDbError: (_error, fallback) => ({ status: 500, error: fallback }) });
  return { app, calls, state };
}

test("aprovação pública exige nome e e-mail válidos", async (t) => { const { app } = setup(), server = createServer(app); await new Promise((resolve) => server.listen(0, resolve)); t.after(() => server.close()); const response = await request(server, "/api/proposals/public/token/decision", { method: "POST", body: { decision: "accepted", name: "", email: "x" } }); assert.equal(response.status, 400); });
test("aprovação pública exige aceite das condições", async (t) => { const { app } = setup(), server = createServer(app); await new Promise((resolve) => server.listen(0, resolve)); t.after(() => server.close()); const response = await request(server, "/api/proposals/public/token/decision", { method: "POST", body: { decision: "accepted", name: "Cliente", email: "cliente@example.com", accepted_terms: false } }); assert.equal(response.status, 400); });
test("aprovação pública cria contrato draft idempotente e não chama gateway", async (t) => {
  const { app, calls, state } = setup(), server = createServer(app); await new Promise((resolve) => server.listen(0, resolve)); t.after(() => server.close());
  const body = { decision: "accepted", name: "Cliente", email: "cliente@example.com", accepted_terms: true };
  const first = await request(server, "/api/proposals/public/token/decision", { method: "POST", body });
  assert.equal(first.status, 200); const firstPayload = await first.json();
  assert.equal(firstPayload.contract_created, true); assert.equal(firstPayload.contract.status, "draft"); assert.equal(firstPayload.replayed, false); assert.equal(state.contracts.length, 1);
  const replay = await request(server, "/api/proposals/public/token/decision", { method: "POST", body });
  assert.equal(replay.status, 200); const replayPayload = await replay.json();
  assert.equal(replayPayload.replayed, true); assert.equal(replayPayload.contract_created, false); assert.equal(replayPayload.contract.id, firstPayload.contract.id); assert.equal(state.contracts.length, 1);
  assert.ok(calls.some((call) => call.sql.includes("update opportunities") && call.params[2] === org));
  assert.ok(calls.some((call) => call.sql.includes("update leads") && call.params[1] === org));
  assert.ok(calls.some((call) => call.sql.includes("insert into contracts") && call.sql.includes("on conflict (organization_id,proposal_id)")));
  assert.ok(!calls.some((call) => call.sql.toLowerCase().includes("mercadopago")));
});
