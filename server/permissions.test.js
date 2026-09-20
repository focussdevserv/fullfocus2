import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { createPermissionMiddleware, isExplicitPublicApiRoute, permissionAllows, permissionTarget } from "./permissions.js";

const request = async (server, path, options = {}) => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
  method: options.method || "GET",
  headers: { "content-type": "application/json", "x-role": options.role || "member" },
  body: options.body === undefined ? undefined : JSON.stringify(options.body)
});

const harness = async (permissions) => {
  const app = express();
  app.use(express.json());
  const pool = { query: async () => ({ rows: [{ permissions }] }) };
  app.use((req, _res, next) => { req.user = { id: 1, organization_id: "org", role: req.get("x-role") }; next(); });
  app.use("/api", createPermissionMiddleware({ pool }));
  app.all("/{*path}", (_req, res) => res.json({ allowed: true }));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  return server;
};

test("permissões ausentes negam leitura e escrita por padrão", () => {
  assert.equal(permissionAllows(null, "crm", "clients", "view"), false);
  assert.equal(permissionAllows(undefined, "crm", "clients", "create"), false);
  assert.equal(permissionAllows({}, "crm", "clients", "edit"), false);
});

test("permissões específicas continuam funcionando", () => {
  const permissions = { clients: ["view", "edit"], finance: { view: true } };
  assert.equal(permissionAllows(permissions, "crm", "clients", "view"), true);
  assert.equal(permissionAllows(permissions, "crm", "clients", "delete"), false);
  assert.equal(permissionAllows(permissions, "finance", "receivables", "view"), true);
  assert.equal(permissionAllows(permissions, "finance", "receivables", "create"), false);
});

test("rota desconhecida não libera mutação nem para owner", async (t) => {
  const server = await harness({ crm: { create: true } }); t.after(() => server.close());
  const response = await request(server, "/api/unknown-resource", { method: "POST", role: "owner", body: {} });
  assert.equal(response.status, 403);
});

test("owner e admin passam em rotas explícitas; member respeita capacidades", async (t) => {
  const server = await harness({ clients: ["view"] }); t.after(() => server.close());
  assert.equal((await request(server, "/api/clients", { role: "owner" })).status, 200);
  assert.equal((await request(server, "/api/clients", { method: "POST", role: "admin", body: {} })).status, 200);
  assert.equal((await request(server, "/api/clients", { role: "member" })).status, 200);
  assert.equal((await request(server, "/api/clients", { method: "POST", role: "member", body: {} })).status, 403);
});

test("create-receivables exige finance/receivables.create", async (t) => {
  assert.deepEqual(permissionTarget("/contracts/9/create-receivables", "POST"), { domain: "finance", table: "receivables", action: "create" });
  const denied = await harness({ contracts: ["create"], operation: { create: true } }); t.after(() => denied.close());
  assert.equal((await request(denied, "/api/contracts/9/create-receivables", { method: "POST", body: {} })).status, 403);
  const allowed = await harness({ receivables: ["create"] }); t.after(() => allowed.close());
  assert.equal((await request(allowed, "/api/contracts/9/create-receivables", { method: "POST", body: {} })).status, 200);
});

test("links públicos usam capacidades sensíveis separadas", () => {
  assert.deepEqual(permissionTarget("/contracts/9/public-link", "POST"), { domain: "operation", table: "contracts", action: "public_link.create" });
  assert.deepEqual(permissionTarget("/contracts/9/public-link", "DELETE"), { domain: "operation", table: "contracts", action: "public_link.revoke" });
  assert.deepEqual(permissionTarget("/proposals/9/public-link", "POST"), { domain: "crm", table: "proposals", action: "public_link.create" });
  assert.equal(permissionAllows({ contracts: { "public_link.create": true } }, "operation", "contracts", "public_link.create"), true);
  assert.equal(permissionAllows({ contracts: ["create"] }, "operation", "contracts", "public_link.create"), false);
});

test("somente webhooks públicos explícitos atravessam sem capacidade", async (t) => {
  assert.equal(isExplicitPublicApiRoute("/webhooks/mercadopago", "POST"), true);
  assert.equal(isExplicitPublicApiRoute("/whatsapp/webhook/token", "POST"), true);
  assert.equal(isExplicitPublicApiRoute("/whatsapp/status", "GET"), false);
  assert.equal(isExplicitPublicApiRoute("/webhooks/outro", "POST"), false);
  const server = await harness(null); t.after(() => server.close());
  assert.equal((await request(server, "/api/webhooks/mercadopago", { method: "POST", body: {} })).status, 200);
  assert.equal((await request(server, "/api/webhooks/outro", { method: "POST", body: {} })).status, 403);
});
