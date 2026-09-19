import crypto from "node:crypto";

const apiUrl = () => String(process.env.MERCADOPAGO_API_URL || "https://api.mercadopago.com").replace(/\/$/, "");
const appUrl = () => String(process.env.PUBLIC_APP_URL || "https://focussdev.space").replace(/\/$/, "");

export function mercadoPagoConfigured() {
  return Boolean(String(process.env.MERCADOPAGO_ACCESS_TOKEN || "").trim());
}

export function mercadoPagoWebhookConfigured() {
  return Boolean(String(process.env.MERCADOPAGO_WEBHOOK_SECRET || "").trim());
}

export function newIdempotencyKey() {
  return crypto.randomUUID();
}

async function requestMercadoPago(path, { method = "GET", body, idempotencyKey, fetchImpl = fetch } = {}) {
  const token = String(process.env.MERCADOPAGO_ACCESS_TOKEN || "").trim();
  if (!token) throw Object.assign(new Error("Mercado Pago não configurado."), { code: "not_configured" });
  const response = await fetchImpl(`${apiUrl()}${path}`, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(12000) : undefined
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { message: text.slice(0, 500) }; }
  if (!response.ok) throw Object.assign(new Error(payload?.message || "Mercado Pago recusou a operação."), { code: "provider_error", status: response.status, details: payload });
  return payload;
}

function payer(email, identification) {
  const result = { email };
  if (identification?.type && identification?.number) result.identification = { type: identification.type, number: identification.number };
  return result;
}

export function normalizePayment(data) {
  const transaction = data?.point_of_interaction?.transaction_data || {};
  const qr = transaction.qr_code_base64 ? `data:image/png;base64,${transaction.qr_code_base64}` : null;
  return {
    id: data?.id == null ? null : String(data.id),
    status: String(data?.status || "pending"),
    external_id: data?.id == null ? null : String(data.id),
    payment_url: transaction.ticket_url || data?.transaction_details?.external_resource_url || null,
    pix_payload: transaction.qr_code || null,
    pix_qr_data_url: qr,
    raw: data
  };
}

function orderPayment(data) {
  return data?.transactions?.payments?.[0] || data?.transaction?.payments?.[0] || {};
}

export function normalizeOrder(data) {
  const payment = orderPayment(data);
  const method = payment.payment_method || {};
  const qr = method.qr_code_base64 ? `data:image/png;base64,${method.qr_code_base64}` : null;
  return {
    id: data?.id == null ? null : String(data.id),
    status: String(payment.status || data?.status || "pending"),
    external_id: data?.id == null ? null : String(data.id),
    payment_id: payment.id == null ? null : String(payment.id),
    payment_url: method.ticket_url || data?.checkout_url || null,
    pix_payload: method.qr_code || null,
    pix_qr_data_url: qr,
    amount: Number(payment.amount ?? data?.total_amount ?? 0),
    raw: data
  };
}

export async function createPixPayment({ amount, description, email, identification, externalReference, expirationDate, idempotencyKey, fetchImpl } = {}) {
  const body = {
    transaction_amount: Number(amount),
    description: String(description || "Cobrança Focussdev"),
    payment_method_id: "pix",
    payer: payer(email, identification),
    external_reference: externalReference
  };
  if (expirationDate) body.date_of_expiration = expirationDate;
  return normalizePayment(await requestMercadoPago("/v1/payments", { method: "POST", body, idempotencyKey, fetchImpl }));
}

export async function createPixOrder({ amount, description, email, externalReference, expirationTime = "P1D", idempotencyKey, fetchImpl } = {}) {
  const total = Number(amount);
  const body = {
    type: "online",
    total_amount: total.toFixed(2),
    external_reference: String(externalReference || ""),
    processing_mode: "automatic",
    transactions: { payments: [{ amount: total.toFixed(2), payment_method: { id: "pix", type: "bank_transfer" }, ...(expirationTime ? { expiration_time: expirationTime } : {}) }] },
    payer: { email: String(email || "") },
    ...(description ? { description: String(description).slice(0, 150) } : {})
  };
  return normalizeOrder(await requestMercadoPago("/v1/orders", { method: "POST", body, idempotencyKey, fetchImpl }));
}

export async function createCheckoutPreference({ amount, title, email, externalReference, notificationUrl = `${appUrl()}/api/webhooks/mercadopago`, idempotencyKey, fetchImpl } = {}) {
  const body = {
    type: "online",
    processing_mode: "automatic",
    total_amount: Number(amount).toFixed(2),
    external_reference: externalReference,
    description: String(title || "Serviço Focussdev").slice(0, 150),
    items: [{ title: String(title || "Serviço Focussdev"), quantity: 1, unit_price: Number(amount).toFixed(2), total_amount: Number(amount).toFixed(2), currency_id: "BRL" }],
    ...(email ? { payer: { email } } : {})
  };
  const data = await requestMercadoPago("/v1/orders", { method: "POST", body: { ...body, ...(notificationUrl ? {} : {}) }, idempotencyKey, fetchImpl });
  const normalized = normalizeOrder(data);
  return { ...normalized, payment_url: data?.checkout_url || normalized.payment_url };
}

export async function getPayment(paymentId, { fetchImpl } = {}) {
  return normalizePayment(await requestMercadoPago(`/v1/payments/${encodeURIComponent(paymentId)}`, { fetchImpl }));
}

export async function getOrder(orderId, { fetchImpl } = {}) {
  return normalizeOrder(await requestMercadoPago(`/v1/orders/${encodeURIComponent(orderId)}`, { fetchImpl }));
}

export async function createSubscription({ reason, email, amount, interval = "months", externalReference, backUrl = `${appUrl()}/configuracoes`, startDate, endDate, fetchImpl } = {}) {
  const body = {
    reason: String(reason || "Assinatura Focussdev").slice(0, 255),
    payer_email: String(email || ""),
    external_reference: String(externalReference || ""),
    auto_recurring: {
      frequency: 1,
      frequency_type: interval === "yearly" ? "months" : "months",
      transaction_amount: Number(amount),
      currency_id: "BRL",
      ...(interval === "yearly" ? { frequency: 12 } : {}),
      ...(startDate ? { start_date: startDate } : {}),
      ...(endDate ? { end_date: endDate } : {})
    },
    back_url: backUrl
  };
  return requestMercadoPago("/preapproval", { method: "POST", body, fetchImpl });
}

export async function updateSubscription(subscriptionId, changes, { fetchImpl } = {}) {
  return requestMercadoPago(`/preapproval/${encodeURIComponent(subscriptionId)}`, { method: "PUT", body: changes, fetchImpl });
}

export async function getSubscription(subscriptionId, { fetchImpl } = {}) {
  return requestMercadoPago(`/preapproval/${encodeURIComponent(subscriptionId)}`, { fetchImpl });
}

export async function cancelOrder(orderId, { idempotencyKey = newIdempotencyKey(), fetchImpl } = {}) {
  return requestMercadoPago(`/v1/orders/${encodeURIComponent(orderId)}/cancel`, { method: "POST", body: {}, idempotencyKey, fetchImpl });
}

export async function refundOrder(orderId, { amount, paymentId, idempotencyKey = newIdempotencyKey(), fetchImpl } = {}) {
  const body = amount == null ? {} : { amount: Number(amount), ...(paymentId ? { payment_id: String(paymentId) } : {}) };
  return requestMercadoPago(`/v1/orders/${encodeURIComponent(orderId)}/refund`, { method: "POST", body, idempotencyKey, fetchImpl });
}

function timingSafeHexEqual(left, right) {
  const a = Buffer.from(String(left || ""), "hex");
  const b = Buffer.from(String(right || ""), "hex");
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

export function validateMercadoPagoWebhook({ signature, requestId, dataId, secret = process.env.MERCADOPAGO_WEBHOOK_SECRET } = {}) {
  const parts = Object.fromEntries(String(signature || "").split(",").map((part) => part.trim().split("=")).filter(([key, value]) => key && value));
  if (!parts.ts || !parts.v1 || !requestId || !dataId || !secret) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`;
  const digest = crypto.createHmac("sha256", String(secret)).update(manifest).digest("hex");
  return timingSafeHexEqual(digest, parts.v1);
}

export function paymentState(status) {
  const value = String(status || "").toLowerCase();
  if (["approved", "processed", "accredited", "completed"].includes(value)) return "paid";
  if (["pending", "in_process", "action_required", "authorized", "created"].includes(value)) return "pending";
  if (["refunded", "charged_back"].includes(value)) return "refunded";
  if (["rejected", "cancelled", "canceled", "expired"].includes(value)) return "cancelled";
  return "pending";
}
