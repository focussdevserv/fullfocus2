import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { maskIntegration, mergeIntegrationConfig, register, resolveIntegrationCapabilities } from "./automacoes.js";

async function setup(t, integration, adapter) {
  const calls = [];
  const pool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.startsWith("select * from integrations")) return { rows: [integration], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
  };
  const app = express();
  app.use(express.json());
  register(app, {
    pool,
    tenant: () => "org",
    asText: (value) => String(value ?? "").trim(),
    classifyDbError: (_error, message) => ({ status: 500, error: message }),
    integrationTestAdapters: adapter ? { webhook: adapter } : {},
  });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  return { calls, request: (path, options) => fetch(`http://127.0.0.1:${server.address().port}${path}`, options) };
}

test("provedor sem adapter fica explicitamente indisponível", async (t) => {
  const h = await setup(t, { id: 1, organization_id: "org", provider: "github", config: {} });
  const response = await h.request("/api/integrations/1/test", { method: "POST" });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).available, false);
});

test("WhatsApp encaminha para a tela dedicada", async (t) => {
  const h = await setup(t, { id: 1, organization_id: "org", provider: "whatsapp", config: {} });
  const response = await h.request("/api/integrations/1/test", { method: "POST" });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).route, "whatsapp");
});

test("catálogo encaminha Mercado Pago para cobranças sem oferecer conexão genérica", async (t) => {
  const h = await setup(t, { id: 1, organization_id: "org", provider: "webhook", config: {} });
  const response = await h.request("/api/integrations/capabilities");
  assert.equal(response.status, 200);
  const capability = (await response.json()).providers.mercado_pago;
  assert.deepEqual({ route: capability.route, configuration: capability.configuration, can_test: capability.can_test }, { route: "cobrancas", configuration: "dedicated", can_test: false });
  const query = h.calls.find(({ sql }) => sql.startsWith("select provider,status,config,last_sync_at from integrations"));
  assert.deepEqual(query.params, ["org"]);
});

test("adapter de webhook registra sucesso confirmado", async (t) => {
  const h = await setup(t, { id: 7, organization_id: "org", provider: "webhook", config: { url: "https://example.com/hook" } }, async () => ({ ok: true, status: 204 }));
  const response = await h.request("/api/integrations/7/test", { method: "POST" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, status: 204, provider: "webhook" });
  const update = h.calls.find(({ sql }) => sql.startsWith("update integrations set status=$1"));
  assert.equal(update.params[0], "connected");
  assert.equal(update.params[1], null);
});

test("adapter de webhook registra erro sem prometer conexão", async (t) => {
  const h = await setup(t, { id: 8, organization_id: "org", provider: "webhook", config: { url: "https://example.com/hook" } }, async () => ({ ok: false, status: 503 }));
  const response = await h.request("/api/integrations/8/test", { method: "POST" });
  assert.equal(response.status, 502);
  assert.equal((await response.json()).ok, false);
  const update = h.calls.find(({ sql }) => sql.startsWith("update integrations set status=$1"));
  assert.deepEqual(update.params.slice(0, 2), ["error", "HTTP 503"]);
});

test("PATCH preserva preferências e segredos mascarados recursivamente", () => {
  const existing = { apiKey: "top-secret", preferences: { color: "blue", token: "nested-secret", alerts: true } };
  const merged = mergeIntegrationConfig(existing, { apiKey: "••••", preferences: { token: "••••", alerts: false } });
  assert.deepEqual(merged, { apiKey: "top-secret", preferences: { color: "blue", token: "nested-secret", alerts: false } });
});

test("respostas mascaram segredos sem revelar sufixos", () => {
  const masked = maskIntegration({ config: { apiKey: "abcd-secret", nested: { client_secret: "client-secret" }, visible: "ok" } });
  assert.deepEqual(masked.config, { apiKey: "••••", nested: { client_secret: "••••" }, visible: "ok" });
  assert.doesNotMatch(JSON.stringify(masked), /abcd-secret|client-secret/);
});

test("capacidades usam estados explícitos sem expor segredos", () => {
  const rows = [
    { provider: "whatsapp", status: "connected", config: { apiKey: "wa-secret", baseUrl: "https://example.com" }, last_sync_at: "2026-09-19T10:00:00Z" },
    { provider: "webhook", status: "disconnected", config: { url: "https://example.com/hook", token: "hook-secret" } },
    { provider: "n8n", status: "error", config: { url: "https://example.com/n8n", apiKey: "n8n-secret" } },
  ];
  const providers = resolveIntegrationCapabilities(rows, { OPENAI_API_KEY: "ai-secret", RESEND_API_KEY: "", EVOLUTION_API_KEY: "", MERCADOPAGO_ACCESS_TOKEN: "mp-token", MERCADOPAGO_WEBHOOK_SECRET: "mp-hook" });
  assert.equal(providers.openai.state, "ready");
  assert.equal(providers.email.state, "missing_secret");
  assert.equal(providers.whatsapp.state, "ready");
  assert.equal(providers.webhook.state, "unverified");
  assert.equal(providers.n8n.state, "error");
  assert.equal(providers.github.state, "disabled");
  assert.doesNotMatch(JSON.stringify(providers), /ai-secret|wa-secret|hook-secret|n8n-secret|mp-token|mp-hook/);
});
