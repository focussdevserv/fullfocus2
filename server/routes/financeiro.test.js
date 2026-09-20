import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import crypto from "node:crypto";
import { processMercadoPagoPayment, register } from "./financeiro.js";

const ORG = "00000000-0000-0000-0000-000000000001";
function setup(options = {}) {
  const calls = [];
  let manualPayments = 0;
  const pool = {
    query: async (sql, params) => { calls.push({ sql, params }); if (sql.includes("generate_series")) return { rows: [{ month: "2026-08", revenue: "10", expense: "3", result: "7" }] }; if (sql.startsWith("select s.*")) return { rows: [{ id: 1, organization_id: ORG, plan: "Pro", amount: "20", status: "active" }] }; if (sql.startsWith("insert into subscriptions")) return { rows: [{ id: 2, organization_id: ORG, plan: "Pro", amount: "20" }] }; if (sql.startsWith("select * from bank_account_transactions")) return { rows: [{ id: 20, bank_account_id: 8, kind: "credit", amount: "100" }] }; return { rows: [] }; },
    connect: async () => ({ query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.startsWith("select * from contracts where")) return { rowCount: 1, rows: [{ id: 9, organization_id: ORG, client_id: 7, status: "active", name: "Site", value: "2700", down_payment: "300", installments: 2, installment_value: "1200", payment_method: "pix" }] };
      if (sql.startsWith("select * from receivables where")) return options.missingReceivable ? { rowCount: 0, rows: [] } : { rowCount: 1, rows: [{ id: 7, organization_id: ORG, client_id: 3, project_id: 4, contract_id: 5, description: "Parcela", amount: "100", status: "pending" }] };
      if (sql.startsWith("select * from payments where organization_id=$1 and receivable_id=$2 and amount=$3")) {
        if (options.replayManual && manualPayments > 0) return { rowCount: 1, rows: [{ id: 31, amount: params[2], method: params[3], external_id: null }] };
        return { rowCount: 0, rows: [] };
      }
      if (sql.startsWith("select coalesce(sum(amount)")) return { rowCount: 1, rows: [{ total: manualPayments * 40 }] };
      if (sql.startsWith("insert into payments")) { manualPayments += 1; return { rowCount: 1, rows: [{ id: 30 + manualPayments, amount: params[2], method: params[3] }] }; }
      if (sql.startsWith("update receivables")) return { rowCount: 1, rows: [{ id: 7, status: params[0] }] };
      if (sql.startsWith("insert into revenues")) { if (options.failRevenue) throw new Error("falha simulada"); return { rowCount: 1, rows: [{ id: 32, status: "confirmed" }] }; }
      if (sql.startsWith("select * from payables where")) return { rowCount: 1, rows: [{ id: 11, organization_id: ORG, description: "Servidor", amount: "120", supplier: "Cloud", status: "pending", due_at: "2026-09-20" }] };
      if (sql.startsWith("select * from bank_accounts where")) return { rowCount: 1, rows: [{ id: 8, organization_id: ORG, current_balance: "500" }] };
      if (sql.startsWith("insert into receivables")) return { rowCount: 1, rows: [{ id: calls.filter((call) => call.sql.startsWith("insert into receivables")).length }] };
      if (sql.startsWith("insert into expenses")) return { rowCount: 1, rows: [{ id: 12, amount: "120", status: "paid" }] };
      if (sql.startsWith("insert into bank_account_transactions")) return { rowCount: 1, rows: [{ id: 20, kind: "credit", amount: "100" }] };
      if (sql.startsWith("update payables")) return { rowCount: 1, rows: [{ id: 11, status: "paid" }] };
      if (sql.startsWith("update bank_accounts")) return { rowCount: 1, rows: [{ id: 8, current_balance: "600" }] };
      return { rowCount: 0, rows: [] };
    }, release() {} })
  };
  const app = express(); app.use(express.json());
  const ctx = { pool, tenant: (_req, res) => { res.locals.org = ORG; return ORG; }, asText: (v) => typeof v === "string" ? v.trim() : "", classifyDbError: (_e, fallback) => ({ status: 503, error: fallback }), validateRelations: async () => {}, ...options.ctx };
  register(app, ctx); const server = createServer(app);
  return { app, server, calls };
}
async function request(t, path, options = {}) { await new Promise((resolve) => t.server.listen(0, resolve)); const port = t.server.address().port; const response = await fetch(`http://127.0.0.1:${port}${path}`, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) }, body: options.body ? JSON.stringify(options.body) : undefined }); t.server.close(); return response; }

test("pagamento rejeita valor inválido antes da baixa", async () => { const t = setup(); const response = await request(t, "/api/receivables/7/record-payment", { method: "POST", body: { amount: 0 } }); assert.equal(response.status, 400); });
test("baixa manual segue a politica configurada e confirma receita", async () => { const t = setup(); const response = await request(t, "/api/receivables/7/record-payment", { method: "POST", body: { amount: 40, method: "pix" } }); assert.equal(response.status, 201); const body = await response.json(); assert.equal(body.payment.method, "pix"); assert.equal(body.receivable.status, "partially_paid"); assert.equal(body.revenue.status, "confirmed"); assert.equal(t.calls.some((call) => call.sql === "commit"), true); });
test("retry sem chave de idempotencia reaproveita a baixa manual recente", async () => {
  const t = setup({ replayManual: true });
  const first = await request(t, "/api/receivables/7/record-payment", { method: "POST", body: { amount: 40, method: "pix" } });
  assert.equal(first.status, 201);
  const second = await request(t, "/api/receivables/7/record-payment", { method: "POST", body: { amount: 40, method: "pix" } });
  assert.equal(second.status, 200);
  const body = await second.json();
  assert.equal(body.replayed, true);
  assert.equal(body.payment.id, 31);
  assert.equal(t.calls.filter((call) => call.sql.startsWith("insert into payments")).length, 1);
  assert.equal(t.calls.filter((call) => call.sql.startsWith("insert into revenues")).length, 1);
});
test("erro na baixa manual faz rollback e nao confirma sucesso", async () => { const t = setup({ failRevenue: true }); const response = await request(t, "/api/receivables/7/record-payment", { method: "POST", body: { amount: 40, method: "pix" } }); assert.equal(response.status, 503); assert.equal(t.calls.some((call) => call.sql === "rollback"), true); assert.equal(t.calls.some((call) => call.sql === "commit"), false); });
test("baixa conta a pagar cria despesa paga", async () => { const t = setup(); const response = await request(t, "/api/payables/11/record-payment", { method: "POST", body: {} }); assert.equal(response.status, 201); assert.equal((await response.json()).expense.status, "paid"); assert.equal(t.calls.some((call) => call.sql.startsWith("insert into expenses")), true); });
test("movimentação bancária atualiza o saldo", async () => { const t = setup(); const response = await request(t, "/api/bank_accounts/8/transactions", { method: "POST", body: { kind: "credit", amount: 100, description: "Recebimento" } }); assert.equal(response.status, 201); assert.equal((await response.json()).bank_account.current_balance, "600"); });
test("cobrança exige conta a receber do workspace", async () => { const t = setup({ missingReceivable: true }); const response = await request(t, "/api/receivables/7/create-charge", { method: "POST", body: { channel: "pix" } }); assert.equal(response.status, 404); });
test("retry da cobrança reutiliza a chave persistida antes de chamar o Mercado Pago", async () => {
  const previousToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  process.env.MERCADOPAGO_ACCESS_TOKEN = "test-token";
  const state = { charge: null, providerKeys: [], inserts: 0 };
  const db = { release() {}, query: async (sql, params = []) => {
    if (sql === "begin" || sql === "commit" || sql === "rollback") return { rowCount: 0, rows: [] };
    if (sql.startsWith("select * from receivables")) return { rowCount: 1, rows: [{ id: 7, organization_id: ORG, client_id: 3, project_id: 4, description: "Parcela", amount: "100", due_at: "2026-09-30", status: "pending" }] };
    if (sql.startsWith("select * from charges")) return { rowCount: state.charge ? 1 : 0, rows: state.charge ? [state.charge] : [] };
    if (sql.startsWith("select name,email,document from clients")) return { rowCount: 1, rows: [{ email: "cliente@example.com" }] };
    if (sql.startsWith("insert into charges")) {
      state.inserts += 1;
      state.charge = { id: 55, organization_id: ORG, receivable_id: 7, provider: "mercado_pago", provider_status: "creating", idempotency_key: params[4], channel: "pix", status: "pending", amount: 100 };
      return { rowCount: 1, rows: [state.charge] };
    }
    throw new Error(`SQL inesperado na transação: ${sql}`);
  } };
  const pool = { connect: async () => db, query: async (sql, params = []) => {
    if (sql.startsWith("update charges set provider_status='creation_failed'")) { state.charge.provider_status = "creation_failed"; return { rowCount: 1, rows: [] }; }
    if (sql.startsWith("update charges set external_id=")) {
      state.charge = { ...state.charge, external_id: params[0], provider_status: params[1], payment_url: params[3], pix_payload: params[4], pix_qr_data_url: params[5], document_kind: params[6] };
      return { rowCount: 1, rows: [state.charge] };
    }
    throw new Error(`SQL inesperado fora da transação: ${sql}`);
  } };
  let attempt = 0;
  const app = express(); app.use(express.json());
  register(app, {
    pool,
    tenant: () => ORG,
    asText: (value) => typeof value === "string" ? value.trim() : "",
    classifyDbError: (_error, fallback) => ({ status: 503, error: fallback }),
    validateRelations: async () => {},
    newIdempotencyKey: () => "stable-charge-key",
    createPixOrder: async ({ idempotencyKey }) => {
      state.providerKeys.push(idempotencyKey);
      attempt += 1;
      if (attempt === 1) throw new Error("timeout após envio");
      return { external_id: "ORDER-1", status: "action_required", payment_url: "https://mp.test/pix", pix_payload: "000201", pix_qr_data_url: "data:image/png;base64,aGk=", raw: { id: "ORDER-1" } };
    }
  });
  const server = createServer(app);
  try {
    const first = await request({ server }, "/api/receivables/7/create-charge", { method: "POST", body: { channel: "pix" } });
    assert.equal(first.status, 502);
    const retry = await request({ server }, "/api/receivables/7/create-charge", { method: "POST", body: { channel: "pix" } });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).created, false);
    assert.equal(state.inserts, 1);
    assert.deepEqual(state.providerKeys, ["stable-charge-key", "stable-charge-key"]);
  } finally {
    if (previousToken === undefined) delete process.env.MERCADOPAGO_ACCESS_TOKEN; else process.env.MERCADOPAGO_ACCESS_TOKEN = previousToken;
  }
});
test("gera entrada e parcelas do contrato sem duplicar", async () => { const t = setup(); const response = await request(t, "/api/contracts/9/create-receivables", { method: "POST", body: {} }); assert.equal(response.status, 201); assert.equal((await response.json()).receivables.length, 3); assert.equal(t.calls.filter((x) => x.sql.startsWith("insert into receivables")).length, 3); });

test("summary agrega por mês", async () => { const t = setup(); const response = await request(t, "/api/finance/summary?months=6"); assert.equal(response.status, 200); assert.deepEqual((await response.json()).summary[0], { month: "2026-08", revenue: "10", expense: "3", result: "7" }); });
test("subscriptions filtra por organização", async () => { const t = setup(); const response = await request(t, "/api/subscriptions"); assert.equal(response.status, 200); assert.equal(t.calls.find((x) => x.sql.startsWith("select s.*")).params[0], ORG); });
test("POST subscriptions válido responde 201", async () => { const t = setup(); const response = await request(t, "/api/subscriptions", { method: "POST", body: { plan: "Pro", amount: 20 } }); assert.equal(response.status, 201); });
test("POST subscriptions inválido responde 400", async () => { const t = setup(); const response = await request(t, "/api/subscriptions", { method: "POST", body: { plan: "", amount: -1 } }); assert.equal(response.status, 400); });

test("webhook repetido persiste um unico pagamento e uma unica receita", async () => {
  const state = { audits: [], payments: [], revenues: [] }, calls = [];
  const db = { release() {}, query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.startsWith("select * from charges")) return { rowCount: 1, rows: [{ id: 8, organization_id: ORG, receivable_id: 7, amount: "100" }] };
    if (sql.startsWith("select id from audit_events")) { const found = state.audits.find((item) => item.event_key === params[1]); return { rowCount: found ? 1 : 0, rows: found ? [{ id: 1 }] : [] }; }
    if (sql.startsWith("select id from payments")) { const found = state.payments.find((item) => item.external_id === params[1]); return { rowCount: found ? 1 : 0, rows: found ? [{ id: 1 }] : [] }; }
    if (sql.startsWith("insert into payments")) { state.payments.push({ external_id: params[4], amount: params[3] }); return { rowCount: 1, rows: [{ id: 1 }] }; }
    if (sql.startsWith("select * from receivables")) return { rowCount: 1, rows: [{ id: 7, amount: "100", description: "Parcela", client_id: 3, project_id: 4, contract_id: 5 }] };
    if (sql.startsWith("select coalesce(sum(amount)")) return { rowCount: 1, rows: [{ total: state.payments.reduce((sum, item) => sum + Number(item.amount), 0) }] };
    if (sql.startsWith("insert into revenues")) { state.revenues.push({ organization_id: params[0], amount: params[5] }); return { rowCount: 1, rows: [{ id: 2 }] }; }
    if (sql.startsWith("insert into audit_events")) { state.audits.push(JSON.parse(params[2])); return { rowCount: 1, rows: [{ id: 3 }] }; }
    return { rowCount: 1, rows: [] };
  } };
  const pool = { connect: async () => db };
  const load = async () => ({ external_id: "PAY-9", payment_id: "PAY-9", status: "approved", amount: 100, raw: { id: "PAY-9", status: "approved" } });
  await processMercadoPagoPayment({ pool, dataId: "PAY-9", getPaymentImpl: load });
  const retry = await processMercadoPagoPayment({ pool, dataId: "PAY-9", getPaymentImpl: load });
  assert.equal(retry.duplicate, true);
  assert.equal(state.payments.length, 1);
  assert.equal(state.revenues.length, 1);
  assert.equal(state.audits.length, 1);
  assert.ok(calls.filter((call) => /update (charges|receivables)/.test(call.sql)).every((call) => call.sql.includes("organization_id")));
});

function webhookHeaders(dataId, requestId = "req-1", timestamp = String(Math.floor(Date.now() / 1000))) {
  const digest = crypto.createHmac("sha256", process.env.MERCADOPAGO_WEBHOOK_SECRET).update(`id:${dataId};request-id:${requestId};ts:${timestamp};`).digest("hex");
  return { "x-request-id": requestId, "x-signature": `ts=${timestamp},v1=${digest}` };
}

test("webhook aguarda persistencia antes do ack e devolve erro para retry", async () => {
  const previousSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  process.env.MERCADOPAGO_WEBHOOK_SECRET = "segredo-de-teste";
  try {
    let persisted = false;
    const success = setup({ ctx: { processMercadoPagoPayment: async () => { await Promise.resolve(); persisted = true; } } });
    const accepted = await request(success, "/api/webhooks/mercadopago?data.id=PAY-1&type=payment", { method: "POST", headers: webhookHeaders("PAY-1"), body: {} });
    assert.equal(accepted.status, 200);
    assert.equal(persisted, true);
    const failure = setup({ ctx: { processMercadoPagoPayment: async () => { throw new Error("banco indisponivel"); } } });
    const rejected = await request(failure, "/api/webhooks/mercadopago?data.id=PAY-2&type=payment", { method: "POST", headers: webhookHeaders("PAY-2"), body: {} });
    assert.equal(rejected.status, 503);
    assert.deepEqual(await rejected.json(), { received: false, error: "Não foi possível persistir o webhook. O Mercado Pago pode tentar novamente." });
  } finally {
    if (previousSecret === undefined) delete process.env.MERCADOPAGO_WEBHOOK_SECRET; else process.env.MERCADOPAGO_WEBHOOK_SECRET = previousSecret;
  }
});

test("webhook correlaciona Payment pelo external_reference quando o id recebido nao e o Order", async () => {
  const calls = [];
  const db = { release() {}, query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.startsWith("select * from charges")) return { rowCount: 1, rows: [{ id: 8, organization_id: ORG, receivable_id: 7, amount: "100" }] };
    if (sql.startsWith("select id from audit_events")) return { rowCount: 0, rows: [] };
    if (sql.startsWith("select id from payments")) return { rowCount: 0, rows: [] };
    if (sql.startsWith("select * from receivables")) return { rowCount: 1, rows: [{ id: 7, amount: "100", description: "Parcela", client_id: 3, project_id: 4, contract_id: 5 }] };
    if (sql.startsWith("select coalesce(sum(amount)")) return { rowCount: 1, rows: [{ total: 0 }] };
    return { rowCount: 1, rows: [] };
  } };
  const pool = { connect: async () => db };
  await processMercadoPagoPayment({ pool, dataId: "PAY-1", getPaymentImpl: async () => ({ external_id: "PAY-1", external_reference: "focussdev:org:receivable:7", status: "pending", amount: 100, raw: { id: "PAY-1", external_reference: "focussdev:org:receivable:7" } }) });
  const lookup = calls.find((call) => call.sql.startsWith("select * from charges"));
  assert.match(lookup.sql, /provider_payload->>'external_reference'/);
  assert.deepEqual(lookup.params, ["PAY-1", "focussdev:org:receivable:7"]);
});

test("reembolso Mercado Pago reconcilia pagamento, receita e conta e aceita replay idempotente", async () => {
  const previousToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  process.env.MERCADOPAGO_ACCESS_TOKEN = "test-token";
  const state = {
    charge: { id: 44, organization_id: ORG, receivable_id: 7, external_id: "ORDER-44", provider: "mercado_pago", status: "paid", amount: "100", refunded_amount: 0, refund_operations: [], provider_payload: {} },
    payment: { id: 55, organization_id: ORG, charge_id: 44, receivable_id: 7, amount: 100, refunded_amount: 0, provider_status: "approved" },
    revenue: { id: 66, organization_id: ORG, payment_id: 55, receivable_id: 7, amount: 100, refunded_amount: 0, net_amount: 100, status: "confirmed" },
    receivable: { id: 7, organization_id: ORG, amount: 100, status: "paid" },
    providerCalls: []
  };
  const query = async (sql, params = []) => {
    if (sql === "begin" || sql === "commit" || sql === "rollback") return { rowCount: 0, rows: [] };
    if (sql.startsWith("select * from charges")) return { rowCount: 1, rows: [{ ...state.charge }] };
    if (sql.startsWith("update charges set refund_idempotency_key")) { state.charge.refund_idempotency_key = params[0]; state.charge.provider_status = "refunding"; return { rowCount: 1, rows: [] }; }
    if (sql.startsWith("select * from payments")) return { rowCount: 1, rows: [{ ...state.payment }] };
    if (sql.startsWith("update payments set refunded_amount")) { state.payment.refunded_amount = params[0]; state.payment.provider_status = params[1]; return { rowCount: 1, rows: [] }; }
    if (sql.startsWith("update revenues set refunded_amount=$1")) { state.revenue.refunded_amount = params[0]; state.revenue.net_amount = 0; state.revenue.status = params[1]; return { rowCount: 1, rows: [] }; }
    if (sql.startsWith("update receivables set status")) { state.receivable.status = params[0]; return { rowCount: 1, rows: [] }; }
    if (sql.startsWith("update charges set status=$1")) { state.charge = { ...state.charge, status: params[0], provider_status: params[1], provider_payload: JSON.parse(params[2]), refunded_amount: params[3], refund_operations: JSON.parse(params[4]), refund_idempotency_key: null }; return { rowCount: 1, rows: [{ ...state.charge }] }; }
    throw new Error(`SQL inesperado no teste de reembolso: ${sql}`);
  };
  const pool = { query, connect: async () => ({ query, release() {} }) };
  // Registra uma aplicação mínima para injetar o pool controlado.
  const app = express(); app.use(express.json());
  register(app, { pool, tenant: (_req, res) => { res.locals.org = ORG; return ORG; }, asText: (v) => typeof v === "string" ? v.trim() : "", classifyDbError: (_e, fallback) => ({ status: 503, error: fallback }), validateRelations: async () => {}, refundOrder: async (_orderId, options) => { state.providerCalls.push(options); return { status: "refunded", id: "REF-44" }; } });
  const server = createServer(app);
  try {
    const first = await request({ server }, "/api/charges/44/refund", { method: "POST", headers: { "idempotency-key": "refund-44" }, body: {} });
    assert.equal(first.status, 200);
    assert.equal(state.payment.provider_status, "refunded");
    assert.equal(state.revenue.status, "refunded");
    assert.equal(state.receivable.status, "refunded");
    assert.equal(state.providerCalls.length, 1);
    const second = await request({ server }, "/api/charges/44/refund", { method: "POST", headers: { "idempotency-key": "refund-44" }, body: {} });
    assert.equal(second.status, 200);
    assert.equal((await second.json()).replayed, true);
    assert.equal(state.providerCalls.length, 1);
  } finally {
    if (previousToken === undefined) delete process.env.MERCADOPAGO_ACCESS_TOKEN; else process.env.MERCADOPAGO_ACCESS_TOKEN = previousToken;
  }
});

test("cancelamento Mercado Pago persiste a chave e aceita replay sem nova chamada", async () => {
  const previousToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  process.env.MERCADOPAGO_ACCESS_TOKEN = "test-token";
  const state = { charge: { id: 45, organization_id: ORG, receivable_id: 8, external_id: "ORDER-45", provider: "mercado_pago", status: "pending", cancel_idempotency_key: null }, providerCalls: 0 };
  const query = async (sql, params = []) => {
    if (sql === "begin" || sql === "commit" || sql === "rollback") return { rowCount: 0, rows: [] };
    if (sql.startsWith("select * from charges")) return { rowCount: 1, rows: [{ ...state.charge }] };
    if (sql.startsWith("update charges set cancel_idempotency_key")) { state.charge.cancel_idempotency_key = params[0]; state.charge.provider_status = "cancelling"; return { rowCount: 1, rows: [] }; }
    if (sql.startsWith("update charges set status='cancelled'")) { state.charge.status = "cancelled"; state.charge.provider_status = params[0]; return { rowCount: 1, rows: [{ ...state.charge }] }; }
    if (sql.startsWith("update receivables set status='cancelled'")) return { rowCount: 1, rows: [] };
    throw new Error(`SQL inesperado no teste de cancelamento: ${sql}`);
  };
  const pool = { query, connect: async () => ({ query, release() {} }) };
  const app = express(); app.use(express.json());
  register(app, { pool, tenant: (_req, res) => { res.locals.org = ORG; return ORG; }, asText: (v) => typeof v === "string" ? v.trim() : "", classifyDbError: (_e, fallback) => ({ status: 503, error: fallback }), validateRelations: async () => {}, cancelOrder: async (_orderId, options) => { state.providerCalls += 1; assert.match(options.idempotencyKey, /charge-cancel/); return { status: "cancelled" }; } });
  const server = createServer(app);
  try {
    const first = await request({ server }, "/api/charges/45/cancel", { method: "POST", body: {} });
    assert.equal(first.status, 200);
    const second = await request({ server }, "/api/charges/45/cancel", { method: "POST", body: {} });
    assert.equal(second.status, 200);
    assert.equal((await second.json()).replayed, true);
    assert.equal(state.providerCalls, 1);
  } finally {
    if (previousToken === undefined) delete process.env.MERCADOPAGO_ACCESS_TOKEN; else process.env.MERCADOPAGO_ACCESS_TOKEN = previousToken;
  }
});
