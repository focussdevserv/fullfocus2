import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import crypto from "node:crypto";
import { registerMercadoPagoWebhookRoutes, verifyMercadoPagoSignature } from "./mercadopago-webhook.js";

test("valida assinatura x-signature do Mercado Pago", () => {
  const secret = "segredo-do-webhook", ts = Math.floor(Date.now() / 1000), dataId = "12345", requestId = "req-1";
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`, digest = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  assert.equal(verifyMercadoPagoSignature({ signature: `ts=${ts},v1=${digest}`, requestId, dataId, secret }), true);
  assert.equal(verifyMercadoPagoSignature({ signature: `ts=${ts},v1=${digest}`, requestId: "outro", dataId, secret }), false);
});

test("webhook sem assinatura válida rejeita a notificação", async (t) => {
  const previousSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = "segredo";
  t.after(() => { if (previousSecret === undefined) delete process.env.MERCADO_PAGO_WEBHOOK_SECRET; else process.env.MERCADO_PAGO_WEBHOOK_SECRET = previousSecret; });
  const app = express(); app.use(express.json()); registerMercadoPagoWebhookRoutes(app, { pool: {}, defaultOrganizationId: "org-a", classifyDbError: () => ({ status: 503, error: "erro" }) });
  const server = createServer(app); await new Promise((resolve) => server.listen(0, resolve)); t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/webhooks/mercadopago`, { method: "POST", headers: { "content-type": "application/json", "x-request-id": "req-1", "x-signature": "ts=1,v1=bad" }, body: JSON.stringify({ type: "payment", data: { id: "123" } }) });
  assert.equal(response.status, 401);
});
