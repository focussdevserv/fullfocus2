import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { register } from "./whatsapp.js";

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
