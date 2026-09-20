import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { register } from "./operacao.js";

const createHarness = (state) => {
  let nextProject = 20, nextReceivable = 30;
  const query = async (sql, params = []) => {
    if (["begin", "commit", "rollback"].includes(sql)) return { rowCount: 0, rows: [] };
    if (sql.startsWith("select * from contracts where id=$1")) return state.contract ? { rowCount: 1, rows: [{ ...state.contract }] } : { rowCount: 0, rows: [] };
    if (sql.startsWith("select * from projects where id=$1")) return state.project ? { rowCount: 1, rows: [{ ...state.project }] } : { rowCount: 0, rows: [] };
    if (sql.startsWith("select * from projects where contract_id")) return state.project ? { rowCount: 1, rows: [{ ...state.project }] } : { rowCount: 0, rows: [] };
    if (sql.startsWith("insert into projects")) { state.project = { id: nextProject++, organization_id: params[0], contract_id: params[1], client_id: params[2], name: params[3], status: "planning", progress: 0 }; return { rowCount: 1, rows: [{ ...state.project }] }; }
    if (sql.startsWith("update contracts set project_id")) { state.contract.project_id = params[0]; return { rowCount: 1, rows: [{ ...state.contract }] }; }
    if (sql.startsWith("select * from receivables where contract_id")) return { rowCount: state.receivables.length, rows: state.receivables.map((row) => ({ ...row })) };
    if (sql.startsWith("update receivables set project_id")) { state.receivables = state.receivables.map((row) => ({ ...row, project_id: row.project_id ?? params[0], client_id: row.client_id ?? params[1], proposal_id: row.proposal_id ?? params[2] })); return { rowCount: state.receivables.length, rows: state.receivables }; }
    if (sql.startsWith("insert into receivables")) { const row = { id: nextReceivable++, organization_id: params[0], client_id: params[1], project_id: params[2], contract_id: params[3], proposal_id: params[4], description: params[5], amount: params[6], due_at: params[7], status: "pending", installment_number: params[8], payment_method: params[9] }; state.receivables.push(row); return { rowCount: 1, rows: [{ ...row }] }; }
    return { rowCount: 0, rows: [] };
  };
  return { query, pool: { query, connect: async () => ({ query, release() {} }) } };
};

const start = async (t, state) => {
  const harness = createHarness(state), app = express(); app.use(express.json());
  register(app, { pool: harness.pool, tenant: () => "org-a", asText: (value) => String(value ?? "").trim(), classifyDbError: (_error, error) => ({ status: 500, error }), validateRelations: async () => {} });
  const server = createServer(app); await new Promise((resolve) => server.listen(0, resolve)); t.after(() => server.close());
  return (path) => fetch(`http://127.0.0.1:${server.address().port}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
};

test("onboarding do contrato cria projeto e recebíveis de forma idempotente", async (t) => {
  const state = { contract: { id: 9, organization_id: "org-a", status: "signed", name: "Site institucional", client_id: 4, proposal_id: 7, value: 1000, total_value: 1000, down_payment: 100, installments: 3, payment_method: "pix" }, project: null, receivables: [] };
  const call = await start(t, state), first = await call("/api/contracts/9/complete-onboarding"), firstBody = await first.json();
  assert.equal(first.status, 201); assert.equal(firstBody.project_created, true); assert.equal(firstBody.receivables_created, 4); assert.equal(state.receivables.length, 4); assert.equal(state.receivables.reduce((sum, row) => sum + Number(row.amount), 0), 1000);
  const second = await call("/api/contracts/9/complete-onboarding"), secondBody = await second.json();
  assert.equal(second.status, 200); assert.equal(secondBody.created, false); assert.equal(secondBody.receivables_created, 0); assert.equal(state.receivables.length, 4);
});

test("onboarding recupera parcelas ausentes sem duplicar as já existentes", async (t) => {
  const state = { contract: { id: 9, organization_id: "org-a", status: "active", name: "Sistema", client_id: 4, value: 900, total_value: 900, down_payment: 0, installments: 3, payment_method: "pix", project_id: 20 }, project: { id: 20, organization_id: "org-a", contract_id: 9, client_id: 4, name: "Sistema" }, receivables: [{ id: 30, organization_id: "org-a", client_id: 4, project_id: null, contract_id: 9, installment_number: 1, amount: 300, status: "pending" }] };
  const call = await start(t, state), response = await call("/api/contracts/9/prepare-onboarding"), body = await response.json();
  assert.equal(response.status, 201); assert.equal(body.project_created, false); assert.equal(body.receivables_created, 2); assert.equal(state.receivables.length, 3); assert.deepEqual(state.receivables.map((row) => row.installment_number), [1, 2, 3]); assert.ok(state.receivables.every((row) => row.project_id === 20));
});
