import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { register as registerCrm } from "./crm.js";
import { register as registerOperations } from "./operacao.js";
import { register as registerFinance } from "./financeiro.js";
import { register as registerWorkspace } from "./project-workspace.js";
import { validateCoherentRelations } from "../relationship-validation.js";

const ORG_A = "org-a";

function invalidRelation(field) {
  const error = new Error(`${field} does not belong to this organization.`);
  error.code = "invalid_relation";
  return error;
}

function context(pool, org = ORG_A) {
  return {
    pool,
    tenant: () => org,
    asText: (value) => String(value ?? "").trim(),
    classifyDbError: (_error, error) => ({ status: 503, error }),
    validateCoherentRelations: (values, tenant) => validateCoherentRelations(pool, values, tenant),
    validateRelations: async (values, tenant) => {
      const relations = { client_id: "clients", project_id: "projects", contract_id: "contracts", proposal_id: "proposals" };
      for (const [field, id] of Object.entries(values)) {
        if (!id || !relations[field]) continue;
        const result = await pool.query(`select 1 from ${relations[field]} where id=$1 and organization_id=$2`, [id, tenant]);
        if (!result.rowCount) throw invalidRelation(field);
      }
    }
  };
}

async function withServer(t, register, ctx, fn) {
  const app = express();
  app.use(express.json());
  register(app, ctx);
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  return fn((path, options = {}) => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  }));
}

test("cadeia comercial aceita vínculos do tenant e preserva cada ID", async (t) => {
  const calls = [];
  const pool = {
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.startsWith("select 1 from")) return { rowCount: 1, rows: [{ ok: 1 }] };
      if (sql.startsWith("select id,status,client_id,project_id from proposals")) return { rowCount: 1, rows: [{ id: 20, status: "accepted", client_id: 10, project_id: 30 }] };
      if (sql.startsWith("select id,id as client_id from clients")) return { rowCount: 1, rows: [{ id: 10, client_id: 10 }] };
      if (sql.startsWith("select id,client_id from projects")) return { rowCount: 1, rows: [{ id: 30, client_id: 10 }] };
      if (sql.startsWith("select id,client_id from proposals")) return { rowCount: 1, rows: [{ id: 20, client_id: 10 }] };
      if (sql.startsWith("select id,client_id from contracts")) return { rowCount: 1, rows: [{ id: 40, client_id: 10 }] };
      if (sql.startsWith("select id,client_id,proposal_id,project_id from contracts")) return { rowCount: 1, rows: [{ id: 40, client_id: 10, proposal_id: 20, project_id: null }] };
      if (sql.startsWith("select * from contracts where proposal_id")) return { rowCount: 0, rows: [] };
      if (sql.startsWith("select count(*)")) return { rowCount: 1, rows: [{ total: 0 }] };
      if (sql.startsWith("insert into proposals")) return { rowCount: 1, rows: [{ id: 20, client_id: 10, project_id: 30, title: "Proposta" }] };
      if (sql.startsWith("insert into contracts")) return { rowCount: 1, rows: [{ id: 40, client_id: 10, proposal_id: 20, project_id: 30 }] };
      if (sql.startsWith("insert into projects")) return { rowCount: 1, rows: [{ id: 30, client_id: 10, contract_id: 40, name: "Projeto" }] };
      return { rowCount: 1, rows: [] };
    },
    connect: async () => ({ query: async (...args) => pool.query(...args), release() {} })
  };
  const crm = await withServer(t, registerCrm, context(pool), (request) => request("/api/proposals", { method: "POST", body: { title: "Proposta", amount: 1000, client_id: 10, project_id: 30 } }));
  const crmBody = await crm.text();
  assert.equal(crm.status, 201, crmBody);
  const operations = await withServer(t, registerOperations, context(pool), async (request) => {
    const contract = await request("/api/contracts", { method: "POST", body: { name: "Contrato", client_id: 10, proposal_id: 20, project_id: 30, value: 1000 } });
    const project = await request("/api/projects", { method: "POST", body: { name: "Projeto", client_id: 10, contract_id: 40 } });
    return { contract, project };
  });
  assert.equal(operations.contract.status, 201);
  assert.equal(operations.project.status, 201);
  assert.ok(calls.filter(({ sql }) => /insert into (proposals|contracts|projects)/.test(sql)).every(({ params }) => params[0] === ORG_A));
});

test("relações de outro tenant são rejeitadas em proposta, contrato, projeto e recebível", async (t) => {
  const pool = {
    query: async (sql) => {
      if (sql.startsWith("select 1 from")) return { rowCount: 0, rows: [] };
      if (sql.startsWith("select * from contracts where")) return { rowCount: 0, rows: [] };
      return { rowCount: 0, rows: [] };
    },
    connect: async () => ({ query: async (sql) => pool.query(sql), release() {} })
  };
  const proposal = await withServer(t, registerCrm, context(pool), (request) => request("/api/proposals", { method: "POST", body: { title: "Vazamento", amount: 1, client_id: 900, project_id: 901 } }));
  assert.equal(proposal.status, 400);
  const contract = await withServer(t, registerOperations, context(pool), (request) => request("/api/contracts", { method: "POST", body: { name: "Vazamento", client_id: 900, value: 1 } }));
  assert.equal(contract.status, 400);
  const project = await withServer(t, registerOperations, context(pool), (request) => request("/api/projects", { method: "POST", body: { name: "Vazamento", client_id: 900, contract_id: 901 } }));
  assert.equal(project.status, 400);
  const receivable = await withServer(t, registerFinance, context(pool), (request) => request("/api/contracts/901/create-receivables", { method: "POST", body: {} }));
  assert.equal(receivable.status, 404);
});

test("consultas por ID não revelam projeto de outro tenant", async (t) => {
  const calls = [];
  const pool = { query: async (sql, params) => { calls.push({ sql, params }); return { rowCount: 0, rows: [] }; } };
  const response = await withServer(t, registerWorkspace, context(pool, ORG_A), (request) => request("/api/projects/901/workspace"));
  assert.equal(response.status, 404);
  assert.deepEqual(calls[0].params, ["901", ORG_A]);
  assert.match(calls[0].sql, /p\.organization_id=\$2/);
});
