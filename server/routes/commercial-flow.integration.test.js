import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { register as registerAccounts } from "./contas.js";
import { register as registerCrm } from "./crm.js";
import { register as registerOperation } from "./operacao.js";
import { register as registerFinance } from "./financeiro.js";
import { registerContractPublicRoutes } from "./contract-public.js";

const ORG = "00000000-0000-0000-0000-000000000001";
const OTHER_ORG = "00000000-0000-0000-0000-000000000002";
const clone = (value) => structuredClone(value);
const result = (rows = []) => ({ rowCount: rows.length, rows });

class CommercialFixture {
  constructor() {
    this.state = { clients: [], proposals: [{ id: 999, organization_id: OTHER_ORG, client_id: 88, title: "Outra empresa", amount: 10, status: "accepted" }], contracts: [], projects: [], receivables: [], payments: [], revenues: [] };
    this.next = { clients: 1, proposals: 10, contracts: 20, projects: 30, receivables: 40, payments: 50, revenues: 60 };
    this.snapshot = null;
    this.calls = [];
    this.failRevenue = false;
  }
  connect = async () => ({ query: this.query, release() {} });
  query = async (sql, params = []) => {
    this.calls.push({ sql, params });
    if (sql === "begin") { this.snapshot = { state: clone(this.state), next: clone(this.next) }; return result(); }
    if (sql === "commit") { this.snapshot = null; return result(); }
    if (sql === "rollback") { if (this.snapshot) { this.state = this.snapshot.state; this.next = this.snapshot.next; this.snapshot = null; } return result(); }
    if (sql.startsWith("select pg_advisory_xact_lock")) return result([{}]);

    if (sql.startsWith("select id from clients where organization_id=$1 and (($2<>''")) return result([]);
    if (sql.startsWith("insert into clients")) { const row = { id: this.next.clients++, organization_id: params[0], company_id: params[1], contact_id: params[2], name: params[3], document: params[4], email: params[5], phone: params[6], status: params[7] }; this.state.clients.push(row); return result([clone(row)]); }

    if (sql.startsWith("insert into proposals")) { const row = { id: this.next.proposals++, organization_id: params[0], opportunity_id: params[1], lead_id: params[2], client_id: params[3], project_id: params[4], title: params[5], amount: params[6], valid_until: params[7], payment_method: params[8], down_payment: params[9], installments: params[10], status: "draft" }; this.state.proposals.push(row); return result([clone(row)]); }
    if (sql.startsWith("select * from proposals where id=$1") && sql.includes("for update")) return result(this.state.proposals.filter((row) => String(row.id) === String(params[0]) && row.organization_id === params[1]).map(clone));
    if (sql.startsWith("update proposals set")) { const row = this.state.proposals.find((item) => String(item.id) === String(params.at(-2)) && item.organization_id === params.at(-1)); if (!row) return result(); const status = params[0]; if (["accepted", "rejected"].includes(status)) row.status = status; return result([clone(row)]); }
    if (sql.startsWith("update opportunities") || sql.startsWith("update leads")) return result([{}]);

    if (sql.startsWith("select id,status,client_id,project_id from proposals")) return result(this.state.proposals.filter((row) => String(row.id) === String(params[0]) && row.organization_id === params[1]).map(clone));
    if (sql.startsWith("select * from contracts where proposal_id")) return result(this.state.contracts.filter((row) => String(row.proposal_id) === String(params[0]) && row.organization_id === params[1]).map(clone));
    if (sql.startsWith("select count(*)::int total from contracts")) return result([{ total: this.state.contracts.filter((row) => row.organization_id === params[0]).length }]);
    if (sql.startsWith("insert into contracts") || (sql.startsWith("with lock as") && sql.includes("insert into contracts"))) { const row = this.fromInsert(sql, params, "contracts"); if (sql.startsWith("with lock as")) { row.client_id = params[3]; row.value = params[4]; row.status = params[7] || "draft"; row.proposal_id = params[9] ?? null; row.project_id = params[10] ?? null; } else { Object.assign(row, { client_id: params[1], opportunity_id: params[2], proposal_id: params[3], name: params[4], status: "draft", value: params[5], total_value: params[5], down_payment: params[6], discount: params[7], installments: params[8], installment_value: params[9], payment_method: params[10], scope_included: params[11], description: params[12] }); } row.id = this.next.contracts++; if (!sql.includes("status") || row.status !== "draft") row.status = "draft"; this.state.contracts.push(row); return result([clone(row)]); }
    if (sql.startsWith("update contracts set public_token_hash")) { const row = this.state.contracts.find((item) => String(item.id) === String(params[1]) && item.organization_id === params[2]); if (!row) return result(); row.public_token_hash = params[0]; if (row.status === "draft") row.status = "awaiting_signature"; return result([clone(row)]); }
    if (sql.startsWith("select * from contracts where public_token_hash")) return result(this.state.contracts.filter((row) => row.public_token_hash === params[0]).map(clone));
    if (sql.startsWith("update contracts set status='signed'")) { const row = this.state.contracts.find((item) => String(item.id) === String(params[1]) && item.organization_id === params[2]); if (!row) return result(); row.status = "signed"; row.signature_data = JSON.parse(params[0]); return result([clone(row)]); }
    if (sql.startsWith("update contracts set project_id")) { const row = this.state.contracts.find((item) => String(item.id) === String(params[1]) && item.organization_id === params[2]); if (!row) return result(); row.project_id = params[0]; return result([clone(row)]); }
    if (sql.startsWith("select * from contracts where id=$1") && sql.includes("for update")) return result(this.state.contracts.filter((row) => String(row.id) === String(params[0]) && row.organization_id === params[1]).map(clone));
    if (sql.startsWith("select id,client_id,proposal_id,project_id from contracts where id=$1")) return result(this.state.contracts.filter((row) => String(row.id) === String(params[0]) && row.organization_id === params[1]).map(clone));

    if (sql.startsWith("select * from projects where id=$1")) return result(this.state.projects.filter((row) => String(row.id) === String(params[0]) && row.organization_id === params[1]).map(clone));
    if (sql.startsWith("select * from projects where contract_id")) return result(this.state.projects.filter((row) => String(row.contract_id) === String(params[0]) && row.organization_id === params[1]).map(clone));
    if (sql.startsWith("insert into projects")) { const row = this.fromInsert(sql, params, "projects"); row.id = this.next.projects++; this.state.projects.push(row); return result([clone(row)]); }

    if (sql.startsWith("select id from receivables where contract_id")) return result(this.state.receivables.filter((row) => String(row.contract_id) === String(params[0]) && row.organization_id === params[1]).map((row) => ({ id: row.id })));
    if (sql.startsWith("insert into receivables")) { const row = this.fromInsert(sql, params, "receivables"); row.id = this.next.receivables++; row.status = "pending"; row.paid_at = null; this.state.receivables.push(row); return result([clone(row)]); }
    if (sql.startsWith("select * from receivables where id=$1") && sql.includes("for update")) return result(this.state.receivables.filter((row) => String(row.id) === String(params[0]) && row.organization_id === params[1]).map(clone));
    if (sql.startsWith("select coalesce(sum(amount),0)::float8 total from payments")) return result([{ total: this.state.payments.filter((row) => String(row.receivable_id) === String(params[0]) && row.organization_id === params[1]).reduce((sum, row) => sum + Number(row.amount), 0) }]);
    if (sql.startsWith("select * from payments where organization_id")) return result(this.state.payments.filter((row) => row.organization_id === params[0] && String(row.receivable_id) === String(params[1]) && row.external_id === params[2]).map(clone));
    if (sql.startsWith("insert into payments")) { const row = { id: this.next.payments++, organization_id: params[0], receivable_id: params[1], amount: params[2], method: params[3], external_id: params[4], paid_at: new Date().toISOString() }; this.state.payments.push(row); return result([clone(row)]); }
    if (sql.startsWith("update receivables set status")) { const row = this.state.receivables.find((item) => String(item.id) === String(params[1]) && item.organization_id === params[2]); if (!row) return result(); row.status = params[0]; if (row.status === "paid") row.paid_at = new Date().toISOString(); return result([clone(row)]); }
    if (sql.startsWith("insert into revenues")) { if (this.failRevenue) throw new Error("falha de receita simulada"); const row = { id: this.next.revenues++, organization_id: params[0], description: params[1], client_id: params[2], project_id: params[3], contract_id: params[4], amount: params[5], net_amount: params[5], payment_method: params[6], status: "confirmed", paid_at: new Date().toISOString() }; this.state.revenues.push(row); return result([clone(row)]); }

    if (sql.startsWith("select c.*,co.name company_name")) return result(this.state.clients.filter((row) => String(row.id) === String(params[0]) && row.organization_id === params[1]).map(clone));
    if (sql.startsWith("select id,name,status,value,total_value")) return result(this.state.contracts.filter((row) => row.organization_id === params[0] && String(row.client_id) === String(params[1])).map(clone));
    if (sql.startsWith("select p.id,p.title")) return result(this.state.proposals.filter((row) => row.organization_id === params[0] && String(row.client_id) === String(params[3])).map(clone));
    if (sql.startsWith("select r.id,r.description")) return result(this.state.receivables.filter((row) => row.organization_id === params[0] && String(row.client_id) === String(params[1])).map((row) => { const paid = this.state.payments.filter((payment) => payment.receivable_id === row.id).reduce((sum, payment) => sum + Number(payment.amount), 0); return { ...clone(row), paid_amount: paid, balance_remaining: Math.max(0, Number(row.amount) - paid) }; }));
    if (sql.startsWith("select p.id,p.receivable_id")) return result(this.state.payments.filter((row) => row.organization_id === params[0] && this.state.receivables.some((receivable) => receivable.id === row.receivable_id && String(receivable.client_id) === String(params[1]))).map(clone));
    if (sql.startsWith("select id,description,amount,net_amount")) return result(this.state.revenues.filter((row) => row.organization_id === params[0] && String(row.client_id) === String(params[1])).map(clone));
    if (sql.startsWith("select coalesce((select sum(p.amount)")) {
      const receivables = this.state.receivables.filter((row) => row.organization_id === params[0] && String(row.client_id) === String(params[1]));
      const receivedTotal = this.state.payments.filter((payment) => payment.organization_id === params[0] && receivables.some((receivable) => receivable.id === payment.receivable_id)).reduce((sum, payment) => sum + Number(payment.amount), 0);
      const balanceOpen = receivables.reduce((sum, receivable) => { const paid = this.state.payments.filter((payment) => payment.organization_id === params[0] && payment.receivable_id === receivable.id).reduce((paidSum, payment) => paidSum + Number(payment.amount), 0); return sum + Math.max(0, Number(receivable.amount) - paid); }, 0);
      const confirmedRevenue = this.state.revenues.filter((row) => row.organization_id === params[0] && String(row.client_id) === String(params[1]) && row.status === "confirmed").reduce((sum, row) => sum + Number(row.amount), 0);
      return result([{ received_total: receivedTotal, balance_open: balanceOpen, confirmed_revenue: confirmedRevenue }]);
    }
    if (sql.startsWith("select id,name,status,progress,client_id,contract_id")) return result(this.state.projects.filter((row) => row.organization_id === params[0] && String(row.client_id) === String(params[1])).map(clone));
    if (sql.includes("generate_series")) { const revenue = this.state.revenues.filter((row) => row.organization_id === params[0] && (!params[2] || String(row.client_id) === String(params[2]))).reduce((sum, row) => sum + Number(row.amount), 0); return result([{ month: "2026-09", revenue, expense: 0, result: revenue }]); }
    if (sql.startsWith("select")) return result([]);
    return result([{}]);
  };
  fromInsert(sql, params, table) {
    const columns = sql.match(new RegExp(`insert into ${table} \\(([^)]+)\\)`, "i"))[1].split(",").map((value) => value.trim());
    const row = {}; columns.forEach((column, index) => { row[column] = params[index]; }); return row;
  }
}

async function request(server, path, { org = ORG, method = "GET", body, headers = {} } = {}) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { "content-type": "application/json", "x-org": org, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = response.status === 204 ? null : await response.json(); return { response, payload };
}

test("fluxo comercial ponta a ponta (fixture transacional, não PostgreSQL real)", async (t) => {
  const fixture = new CommercialFixture(), pool = { query: fixture.query, connect: fixture.connect };
  const tenant = (req) => req.get("x-org") || ORG;
  const asText = (value) => typeof value === "string" ? value.trim() : "";
  const classifyDbError = (_error, fallback) => ({ status: 503, error: fallback });
  const validateRelations = async (links, org) => { for (const [key, value] of Object.entries(links)) { if (!value) continue; const collection = { client_id: "clients", proposal_id: "proposals", project_id: "projects" }[key]; if (collection && !fixture.state[collection].some((row) => String(row.id) === String(value) && row.organization_id === org)) { const error = new Error(`${key} não pertence a este workspace.`); error.code = "invalid_relation"; throw error; } } };
  const context = { pool, tenant, asText, classifyDbError, validateRelations };
  const app = express(); app.use(express.json());
  registerAccounts(app, context); registerCrm(app, context); registerOperation(app, context); registerFinance(app, context);
  registerContractPublicRoutes(app, { ...context, requireAuth: (_req, _res, next) => next() });
  const server = createServer(app); await new Promise((resolve) => server.listen(0, resolve)); t.after(() => server.close());

  const client = await request(server, "/api/clients/quick", { method: "POST", body: { name: "Cliente E2E" } });
  assert.equal(client.response.status, 201); const clientId = client.payload.client.id;
  const proposal = await request(server, "/api/proposals", { method: "POST", body: { title: "Projeto E2E", client_id: clientId, amount: 100, down_payment: 20, installments: 3, payment_method: "pix" } });
  assert.equal(proposal.response.status, 201); const proposalId = proposal.payload.proposal.id;
  const accepted = await request(server, `/api/proposals/${proposalId}`, { method: "PATCH", body: { status: "accepted" } });
  assert.equal(accepted.response.status, 200); assert.equal(accepted.payload.replayed, false);
  assert.equal(accepted.payload.contract_created, true); assert.equal(accepted.payload.contract.proposal_id, proposalId);
  assert.equal(fixture.state.contracts.length, 1);
  assert.equal((await request(server, `/api/proposals/${proposalId}`, { method: "PATCH", body: { status: "accepted" } })).payload.replayed, true);
  assert.equal((await request(server, `/api/proposals/${proposalId}`, { method: "PATCH", body: { status: "rejected" } })).response.status, 409);

  const contractRequest = { name: "Contrato E2E", client_id: clientId, proposal_id: proposalId, value: 100, total_value: 100, down_payment: 20, installments: 3, payment_method: "pix" };
  const contract = await request(server, "/api/contracts", { method: "POST", body: contractRequest });
  assert.equal(contract.response.status, 200); assert.equal(contract.payload.created, false); const contractId = contract.payload.contract.id;
  const contractReplay = await request(server, "/api/contracts", { method: "POST", body: contractRequest });
  assert.equal(contractReplay.response.status, 200); assert.equal(contractReplay.payload.contract.id, contractId); assert.equal(contractReplay.payload.created, false);
  const rejected = await request(server, "/api/proposals", { method: "POST", body: { title: "Recusada", client_id: clientId, amount: 10 } });
  await request(server, `/api/proposals/${rejected.payload.proposal.id}`, { method: "PATCH", body: { status: "rejected" } });
  assert.equal((await request(server, "/api/contracts", { method: "POST", body: { ...contractRequest, proposal_id: rejected.payload.proposal.id } })).response.status, 400);
  assert.equal((await request(server, "/api/contracts", { method: "POST", body: { ...contractRequest, proposal_id: 999 } })).response.status, 400);

  const link = await request(server, `/api/contracts/${contractId}/public-link`, { method: "POST", body: {} });
  assert.equal(link.response.status, 201);
  const signatureBody = { name: "Cliente E2E", email: "cliente@example.com", accepted_terms: true };
  const signed = await request(server, `/api/contracts/public/${link.payload.token}/sign`, { method: "POST", body: signatureBody });
  assert.equal(signed.response.status, 200); assert.equal(signed.payload.project_created, true); const projectId = signed.payload.project.id;
  const signReplay = await request(server, `/api/contracts/public/${link.payload.token}/sign`, { method: "POST", body: signatureBody });
  assert.equal(signReplay.response.status, 200); assert.equal(signReplay.payload.replayed, true); assert.equal(fixture.state.projects.length, 1);

  const installments = await request(server, `/api/contracts/${contractId}/create-receivables`, { method: "POST", body: {} });
  assert.equal(installments.response.status, 201); assert.equal(installments.payload.receivables.reduce((sum, row) => sum + Number(row.amount), 0), 100);
  assert.ok(installments.payload.receivables.every((row) => row.client_id === clientId && row.proposal_id === proposalId && row.contract_id === contractId && row.project_id === projectId && row.status === "pending"));
  const installmentsReplay = await request(server, `/api/contracts/${contractId}/create-receivables`, { method: "POST", body: {} });
  assert.equal(installmentsReplay.response.status, 200); assert.equal(installmentsReplay.payload.created, false); assert.equal(fixture.state.receivables.length, 4);

  const receivable = fixture.state.receivables[0], beforePayments = fixture.state.payments.length;
  fixture.failRevenue = true;
  const failedPayment = await request(server, `/api/receivables/${receivable.id}/record-payment`, { method: "POST", headers: { "idempotency-key": "payment-failure-1" }, body: { amount: receivable.amount, method: "pix" } });
  fixture.failRevenue = false; assert.equal(failedPayment.response.status, 503); assert.equal(fixture.state.payments.length, beforePayments); assert.equal(fixture.state.receivables[0].status, "pending");
  const payment = await request(server, `/api/receivables/${receivable.id}/record-payment`, { method: "POST", headers: { "idempotency-key": "payment-success-1" }, body: { amount: receivable.amount, method: "pix" } });
  assert.equal(payment.response.status, 201); assert.equal(payment.payload.receivable.status, "paid"); assert.equal(payment.payload.revenue.status, "confirmed");
  const paymentReplay = await request(server, `/api/receivables/${receivable.id}/record-payment`, { method: "POST", headers: { "idempotency-key": "payment-success-1" }, body: { amount: receivable.amount, method: "pix" } });
  assert.equal(paymentReplay.response.status, 200); assert.equal(paymentReplay.payload.replayed, true); assert.equal(fixture.state.payments.length, 1); assert.equal(fixture.state.revenues.length, 1);

  const overview = await request(server, `/api/clients/${clientId}/overview`);
  assert.equal(overview.response.status, 200); assert.equal(overview.payload.contracts[0].proposal_id, proposalId); assert.equal(overview.payload.projects[0].contract_id, contractId); assert.equal(overview.payload.receivables[0].project_id, projectId); assert.equal(overview.payload.payments.length, 1); assert.equal(overview.payload.revenues.length, 1); assert.equal(overview.payload.summary.received_total, 20); assert.equal(overview.payload.summary.balance_open, 80);
  const finance = await request(server, `/api/finance/summary?months=1&client_id=${clientId}`);
  assert.equal(finance.response.status, 200); assert.equal(finance.payload.summary[0].revenue, 20); assert.ok(fixture.calls.find((call) => call.sql.includes("generate_series")).sql.includes("client_id=$3"));
});
