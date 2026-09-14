import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { registerPortalPublicRoute } from "./portal-public.js";

async function request(server, path, options = {}) { const address = server.address(); return fetch(`http://127.0.0.1:${address.port}${path}`, { ...options, headers: { "content-type": "application/json" }, body: options.body === undefined ? undefined : JSON.stringify(options.body) }); }
function setup() { const calls = []; const query = async (sql, params) => { calls.push({ sql, params }); if (sql.startsWith("select client_id")) return { rowCount: 1, rows: [{ client_id: 4, organization_id: "org" }] }; return { rowCount: 1, rows: [{ id: 8, title: "Acesso", status: "open", priority: "high" }] }; }; const app = express(); app.use(express.json()); registerPortalPublicRoute(app, { pool: { query } }); return { app, calls }; }

test("portal rejeita chamado sem título e descrição", async (t) => { const { app } = setup(), server = createServer(app); await new Promise((resolve) => server.listen(0, resolve)); t.after(() => server.close()); const response = await request(server, "/api/portal/token/tickets", { method: "POST", body: { title: "", description: "" } }); assert.equal(response.status, 400); });
test("portal cria chamado vinculado ao cliente do token", async (t) => { const { app, calls } = setup(), server = createServer(app); await new Promise((resolve) => server.listen(0, resolve)); t.after(() => server.close()); const response = await request(server, "/api/portal/token/tickets", { method: "POST", body: { title: "Problema no acesso", description: "Não consigo entrar no projeto", priority: "high" } }); assert.equal(response.status, 201); assert.equal((await response.json()).ticket.id, 8); assert.ok(calls.some((call) => call.sql.includes("insert into tickets") && call.params[0] === "org" && call.params[3] === 4)); });
