import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { cancelOrder, createPixOrder, createPixPayment, createSubscription, normalizeOrder, normalizePayment, paymentState, refundOrder, validateMercadoPagoWebhook } from "./mercadopago.js";

test("Pix usa endpoint correto e envia idempotência", async () => {
  const calls = [];
  const previousToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  process.env.MERCADOPAGO_ACCESS_TOKEN = "test-token";
  const result = await createPixPayment({ amount: 99.9, description: "Site", email: "cliente@example.com", externalReference: "ref-1", idempotencyKey: "idem-1", fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ id: 123, status: "pending", point_of_interaction: { transaction_data: { qr_code: "000201", qr_code_base64: "aGk=", ticket_url: "https://mp.test/pix" } } }), { status: 201, headers: { "content-type": "application/json" } });
  } });
  if (previousToken === undefined) delete process.env.MERCADOPAGO_ACCESS_TOKEN; else process.env.MERCADOPAGO_ACCESS_TOKEN = previousToken;
  assert.equal(calls[0].url, "https://api.mercadopago.com/v1/payments");
  assert.equal(calls[0].options.headers["x-idempotency-key"], "idem-1");
  assert.equal(JSON.parse(calls[0].options.body).payment_method_id, "pix");
  assert.deepEqual(result, { id: "123", status: "pending", external_id: "123", payment_url: "https://mp.test/pix", pix_payload: "000201", pix_qr_data_url: "data:image/png;base64,aGk=", raw: { id: 123, status: "pending", point_of_interaction: { transaction_data: { qr_code: "000201", qr_code_base64: "aGk=", ticket_url: "https://mp.test/pix" } } } });
});

test("assinatura do webhook Mercado Pago é validada", () => {
  const secret = "secret-test";
  const manifest = "id:123;request-id:req-1;ts:1700000000;";
  const digest = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  const input = { signature: `ts=1700000000,v1=${digest}`, requestId: "req-1", dataId: "123", secret };
  assert.equal(validateMercadoPagoWebhook(input), true);
  assert.equal(validateMercadoPagoWebhook({ ...input, dataId: "124" }), false);
});

test("estados externos viram estados financeiros internos", () => {
  assert.equal(paymentState("approved"), "paid");
  assert.equal(paymentState("in_process"), "pending");
  assert.equal(paymentState("rejected"), "cancelled");
  assert.equal(paymentState("refunded"), "refunded");
  assert.equal(normalizePayment({ id: 8, status: "approved" }).external_id, "8");
});

test("Orders API cria Pix e retorna QR/copia e cola", async () => {
  const previousToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  process.env.MERCADOPAGO_ACCESS_TOKEN = "test-token";
  const calls = [];
  const result = await createPixOrder({ amount: 1499, description: "Site profissional", email: "cliente@example.com", externalReference: "focussdev_ref", idempotencyKey: "order-idem-1", fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ id: "ORD-1", status: "action_required", transactions: { payments: [{ id: "PAY-1", status: "action_required", amount: "1499.00", payment_method: { ticket_url: "https://mp.test/ticket", qr_code: "000201", qr_code_base64: "aGk=" } }] } }), { status: 201 });
  } });
  if (previousToken === undefined) delete process.env.MERCADOPAGO_ACCESS_TOKEN; else process.env.MERCADOPAGO_ACCESS_TOKEN = previousToken;
  assert.equal(calls[0].url, "https://api.mercadopago.com/v1/orders");
  assert.equal(calls[0].options.headers["x-idempotency-key"], "order-idem-1");
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.type, "online");
  assert.equal(body.processing_mode, "automatic");
  assert.equal(body.transactions.payments[0].payment_method.id, "pix");
  assert.equal(result.external_id, "ORD-1");
  assert.equal(result.payment_id, "PAY-1");
  assert.equal(result.pix_payload, "000201");
  assert.equal(normalizeOrder({ id: "ORD-2", total_amount: "10.00", status: "processed" }).external_id, "ORD-2");
});

test("assinatura e operações de ciclo de vida usam endpoints do Mercado Pago", async () => {
  const previousToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  process.env.MERCADOPAGO_ACCESS_TOKEN = "test-token";
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ id: "pre-1", status: "pending", init_point: "https://mp.test/subscribe" }), { status: 200 });
  };
  const subscription = await createSubscription({ reason: "Manutenção", email: "cliente@example.com", amount: 297, interval: "monthly", externalReference: "sub-1", fetchImpl });
  await cancelOrder("ORD-1", { fetchImpl });
  await refundOrder("ORD-1", { amount: 10, paymentId: "PAY-1", fetchImpl });
  if (previousToken === undefined) delete process.env.MERCADOPAGO_ACCESS_TOKEN; else process.env.MERCADOPAGO_ACCESS_TOKEN = previousToken;
  assert.equal(subscription.init_point, "https://mp.test/subscribe");
  assert.equal(calls[0].url, "https://api.mercadopago.com/preapproval");
  assert.equal(calls[1].url, "https://api.mercadopago.com/v1/orders/ORD-1/cancel");
  assert.equal(calls[2].url, "https://api.mercadopago.com/v1/orders/ORD-1/refund");
  assert.deepEqual(JSON.parse(calls[2].options.body), { amount: 10, payment_id: "PAY-1" });
});
