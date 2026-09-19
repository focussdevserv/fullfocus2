import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import { createServer } from "node:http";
import { registerPortalPublicRoute } from "./portal-public.js";

const tokenHash = (token) => crypto.createHash("sha256").update(token).digest("hex");

async function request(server, path, options = {}) {
  const address = server.address();
  return fetch(`http://127.0.0.1:${address.port}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

function setup() {
  const calls = [];
  const query = async (sql, params) => {
    calls.push({ sql, params });
    const validLink = params?.[0] === tokenHash("token");
    if (sql.includes("from client_portal_links")) {
      return validLink
        ? { rowCount: 1, rows: [{ id: 2, client_id: 4, organization_id: "org", portal_auth_enabled: false }] }
        : { rowCount: 0, rows: [] };
    }
    if (sql.startsWith("select id,name from clients")) return { rowCount: 1, rows: [{ id: 4, name: "Cliente <Seguro>" }] };
    if (sql.includes("insert into tickets")) return { rowCount: 1, rows: [{ id: 8, title: "Acesso", status: "open", priority: "high" }] };
    return { rowCount: 0, rows: [] };
  };
  const app = express();
  app.use(express.json());
  registerPortalPublicRoute(app, { pool: { query } });
  return { app, calls };
}

async function listen(app, t) {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  return server;
}

test("portal HTML responde rapidamente com conteúdo seguro", async (t) => {
  const { app } = setup();
  const server = await listen(app, t);
  const response = await request(server, "/api/portal/token", {
    headers: { accept: "text/html" },
    signal: AbortSignal.timeout(500),
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/html/);
  const body = await response.text();
  assert.match(body, /Cliente &lt;Seguro&gt;/);
  assert.doesNotMatch(body, /Cliente <Seguro>/);
  assert.match(body, /<script src="\/portal-actions\.js\?v=2" data-token="token"><\/script>/);
});

test("portal HTML rejeita token inválido sem ficar pendurado", async (t) => {
  const { app } = setup();
  const server = await listen(app, t);
  const response = await request(server, "/api/portal/invalido", {
    headers: { accept: "text/html" },
    signal: AbortSignal.timeout(500),
  });
  assert.equal(response.status, 404);
});

test("portal rejeita chamado sem título e descrição", async (t) => { const { app } = setup(), server = createServer(app); await new Promise((resolve) => server.listen(0, resolve)); t.after(() => server.close()); const response = await request(server, "/api/portal/token/tickets", { method: "POST", body: { title: "", description: "" } }); assert.equal(response.status, 400); });
test("portal cria chamado vinculado ao cliente do token", async (t) => { const { app, calls } = setup(), server = createServer(app); await new Promise((resolve) => server.listen(0, resolve)); t.after(() => server.close()); const response = await request(server, "/api/portal/token/tickets", { method: "POST", body: { title: "Problema no acesso", description: "Não consigo entrar no projeto", priority: "high" } }); assert.equal(response.status, 201); assert.equal((await response.json()).ticket.id, 8); assert.ok(calls.some((call) => call.sql.includes("insert into tickets") && call.params[0] === "org" && call.params[3] === 4)); });
