import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { register } from "./crm.js";

test("lista de leads aplica busca, filtros e paginação no workspace", async (t) => {
  const calls = [];
  const pool = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [{ id: 4, name: "Lead" }], rowCount: 1 }; } };
  const app = express();
  register(app, { pool, tenant: () => "org-a", asText: (value) => String(value ?? "").trim(), classifyDbError: (_error, message) => ({ status: 503, error: message }), validateRelations: async () => {} });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/leads?search=ana&status=qualified&source=whatsapp&owner_id=9&limit=25&offset=50`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.leads.length, 1);
  assert.deepEqual(body.pagination, { limit: 25, offset: 50, returned: 1 });
  assert.match(calls[0].sql, /l\.name ilike/);
  assert.match(calls[0].sql, /l\.status=\$3/);
  assert.match(calls[0].sql, /l\.source=\$4/);
  assert.deepEqual(calls[0].params, ["org-a", "%ana%", "qualified", "whatsapp", "9", 25, 50]);
});

test("lista de oportunidades aplica busca e filtros no workspace", async (t) => {
  const calls = [];
  const pool = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [{ id: 8, name: "Site" }], rowCount: 1 }; } };
  const app = express();
  register(app, { pool, tenant: () => "org-a", asText: (value) => String(value ?? "").trim(), classifyDbError: (_error, message) => ({ status: 503, error: message }), validateRelations: async () => {} });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/opportunities?search=site&stage=negotiation&owner_id=4&limit=10`);
  assert.equal(response.status, 200);
  assert.match(calls[0].sql, /o\.name ilike/);
  assert.match(calls[0].sql, /o\.stage=\$3/);
  assert.deepEqual(calls[0].params, ["org-a", "%site%", "negotiation", "4", 10, 0]);
});

test("lista de propostas aplica filtros e paginação no workspace", async (t) => {
  const calls = [];
  const pool = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [{ id: 12, title: "Proposta" }], rowCount: 1 }; } };
  const app = express();
  register(app, { pool, tenant: () => "org-a", asText: (value) => String(value ?? "").trim(), classifyDbError: (_error, message) => ({ status: 503, error: message }), validateRelations: async () => {} });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/proposals?search=site&client_id=3&status=sent&limit=5&offset=10`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.proposals.length, 1);
  assert.deepEqual(body.pagination, { limit: 5, offset: 10, returned: 1 });
  assert.match(calls[0].sql, /p\.title ilike/);
  assert.match(calls[0].sql, /p\.client_id=\$3/);
  assert.deepEqual(calls[0].params, ["org-a", "%site%", "3", "sent", 5, 10]);
});

test("filtro aberto de oportunidades exclui ganhos e perdas no banco", async (t) => {
  const calls = [];
  const pool = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [], rowCount: 0 }; } };
  const app = express();
  register(app, { pool, tenant: () => "org-a", asText: (value) => String(value ?? "").trim(), classifyDbError: (_error, message) => ({ status: 503, error: message }), validateRelations: async () => {} });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/opportunities?stage=open`);
  assert.equal(response.status, 200);
  assert.match(calls[0].sql, /o\.stage not in \('won','lost'\)/);
  assert.deepEqual(calls[0].params, ["org-a", 100, 0]);
});

test("lista de oportunidades filtra por cliente sem atravessar workspaces", async (t) => {
  const calls = [];
  const pool = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [{ id: 8, name: "Site", client_id: 7 }], rowCount: 1 }; } };
  const app = express();
  register(app, { pool, tenant: () => "org-a", asText: (value) => String(value ?? "").trim(), classifyDbError: (_error, message) => ({ status: 503, error: message }), validateRelations: async () => {} });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/opportunities?client_id=7`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.opportunities[0].client_id, 7);
  assert.match(calls[0].sql, /o\.organization_id=\$1/);
  assert.match(calls[0].sql, /o\.client_id=\$2/);
  assert.match(calls[0].sql, /left join clients c on c\.id=o\.client_id and c\.organization_id=o\.organization_id/);
  assert.deepEqual(calls[0].params, ["org-a", "7", 100, 0]);
});
