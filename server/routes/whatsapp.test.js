import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { register, webhookTokenFor } from "./whatsapp.js";

function response(status, payload) {
  return { status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(payload) };
}

async function request(server, path, options = {}) {
  const address = server.address();
  return fetch(`http://127.0.0.1:${address.port}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

test("conectar cria instância, registra webhook e devolve apenas o QR", async (t) => {
  const calls = [];
  const secret = "server-only-api-key";
  const pool = {
    query: async (sql) => {
      if (sql.startsWith("select id, status, config from integrations")) {
        return { rowCount: 1, rows: [{ id: 3, status: "disconnected", config: { baseUrl: "https://example.com", apiKey: secret } }] };
      }
      if (sql.startsWith("select role from users")) return { rowCount: 1, rows: [{ role: "owner" }] };
      return { rowCount: 1, rows: [] };
    },
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).startsWith("http://127.0.0.1:")) return originalFetch(url, options);
    calls.push({ url: String(url), options });
    if (String(url).includes("connectionState")) {
      return calls.filter((call) => call.url.includes("connectionState")).length === 1
        ? response(404, { message: "not found" })
        : response(200, { instance: { state: "open" } });
    }
    if (String(url).includes("/instance/create")) return response(201, { qrcode: { base64: "qr-from-create" } });
    if (String(url).includes("/instance/connect")) return response(200, { base64: "qr-from-connect", pairingCode: "123456" });
    if (String(url).includes("/webhook/set")) return response(200, { ok: true });
    throw new Error(`URL inesperada no teste: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: "user-1" }; next(); });
  register(app, { pool, tenant: () => "org-1", classifyDbError: (error, fallback) => ({ status: 500, error: error.message || fallback }) });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());

  const result = await request(server, "/api/whatsapp/connect", { method: "POST", body: {} });
  const body = await result.json();
  assert.equal(result.status, 200);
  assert.equal(body.state, "open");
  assert.equal(body.qr.base64, "qr-from-connect");
  assert.equal(JSON.stringify(body).includes(secret), false);
  assert.ok(calls.some((call) => call.url.includes("/instance/create")));
  assert.ok(calls.some((call) => call.url.includes("/webhook/set")));
  assert.ok(calls.every((call) => call.options.headers.apikey === secret));
});

test("webhook repetido aceita provider_message_id uma vez antes de incrementar não lidos ou acionar agente", async (t) => {
  const org = "00000000-0000-0000-0000-000000000001";
  const providerIds = new Set();
  let unreadUpdates = 0;
  let agentConfigReads = 0;
  const previousAllowed = process.env.ASSISTANT_WHATSAPP_NUMBER;
  process.env.ASSISTANT_WHATSAPP_NUMBER = "5511999990000";
  t.after(() => { if (previousAllowed === undefined) delete process.env.ASSISTANT_WHATSAPP_NUMBER; else process.env.ASSISTANT_WHATSAPP_NUMBER = previousAllowed; });
  const pool = { query: async (sql, params = []) => {
    if (sql.startsWith("select organization_id from integrations")) return { rowCount: 1, rows: [{ organization_id: org }] };
    if (sql.startsWith("select id from conversations")) return { rowCount: 1, rows: [{ id: 9 }] };
    if (sql.startsWith("update conversations set remote_number")) return { rowCount: 1, rows: [] };
    if (sql.startsWith("insert into messages") && sql.includes("provider_message_id")) {
      const providerMessageId = params[3];
      if (providerIds.has(providerMessageId)) return { rowCount: 0, rows: [] };
      providerIds.add(providerMessageId);
      return { rowCount: 1, rows: [{ id: 11 }] };
    }
    if (sql.startsWith("update conversations set last_message_at") && sql.includes("unread_count=unread_count+1")) { unreadUpdates += 1; return { rowCount: 1, rows: [] }; }
    if (sql.startsWith("select enabled,model,system_prompt from agent_configs")) { agentConfigReads += 1; return { rowCount: 1, rows: [{ enabled: false }] }; }
    throw new Error(`SQL inesperado: ${sql}`);
  } };
  const app = express(); app.use(express.json());
  register(app, { pool, tenant: () => org, classifyDbError: (error, fallback) => ({ status: 500, error: error.message || fallback }) });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  const token = webhookTokenFor(org);
  const payload = { event: "messages.upsert", instance: "focus-00000000-aux", data: { key: { id: "provider-message-1", remoteJid: "5511999990000@s.whatsapp.net", fromMe: false }, message: { conversation: "Olá" }, pushName: "Cliente" } };
  const first = await request(server, `/api/whatsapp/webhook/${token}`, { method: "POST", body: payload });
  const repeated = await request(server, `/api/whatsapp/webhook/${token}`, { method: "POST", body: payload });
  assert.equal(first.status, 204);
  assert.equal(repeated.status, 204);
  assert.equal(providerIds.size, 1);
  assert.equal(unreadUpdates, 1);
  assert.equal(agentConfigReads, 1);
});
