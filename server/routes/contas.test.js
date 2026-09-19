import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import crypto from "node:crypto";
import { isValidCnpj, pickCnpj, register } from "./contas.js";

const org = "00000000-0000-0000-0000-000000000001";
function harness() {
  const calls = [];
  const invalidHash = crypto.createHash("sha256").update("token-inexistente").digest("hex");
  const pool = { query: async (sql, params) => { calls.push({ sql, params }); if (sql.startsWith("select c.*,co.name company_name")) return { rowCount: 1, rows: [{ id: 7, name: "Cliente teste", company_id: null, contact_id: null }] }; if (sql.startsWith("select id from clients")) return { rowCount: 1, rows: [{ id: params[0] }] }; if (sql.startsWith("insert into client_portal_links")) return { rowCount: 1, rows: [] }; if (sql.startsWith("select client_id, organization_id")) return { rowCount: params[0] === invalidHash ? 0 : 1, rows: [{ client_id: 7, organization_id: org }] }; if (sql.startsWith("select name from clients")) return { rowCount: 1, rows: [{ name: "Cliente teste" }] }; if (sql.startsWith("select id,name,status")) return { rows: [{ id: 1, name: "Contrato", status: "active", value: "100" }] }; if (sql.startsWith("select id,description")) return { rows: [] }; return { rows: [] }; } };
  const app = express(); app.use(express.json()); register(app, { pool, tenant: (_req, _res) => org, asText: (v) => typeof v === "string" ? v.trim() : "", classifyDbError: () => ({ status: 503, error: "erro" }) });
  return { app, calls };
}

async function request(t, path, options) { const server = createServer(t.app); await new Promise((resolve) => server.listen(0, resolve)); try { const address = server.address(); return await fetch(`http://127.0.0.1:${address.port}${path}`, options); } finally { server.close(); } }

test("isValidCnpj aceita CNPJ válido", () => assert.equal(isValidCnpj("11.222.333/0001-81"), true));
test("isValidCnpj rejeita dígitos repetidos e tamanho inválido", () => { assert.equal(isValidCnpj("11.111.111/1111-11"), false); assert.equal(isValidCnpj("123"), false); });
test("GET CNPJ inválido responde 400", async () => { const h = harness(); const response = await request(h, "/api/cnpj/123"); assert.equal(response.status, 400); });
test("portal-link gera token base64url de 32 bytes", async () => { const h = harness(); const response = await request(h, "/api/clients/7/portal-link", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); assert.equal(response.status, 201); const body = await response.json(); assert.equal(Buffer.from(body.token, "base64url").length, 32); assert.equal(h.calls.some((x) => x.sql.includes("organization_id")), true); });
test("overview do cliente agrega ficha 360 e filtra organizacao", async () => { const h = harness(); const response = await request(h, "/api/clients/7/overview"); assert.equal(response.status, 200); const body = await response.json(); assert.equal(body.client.name, "Cliente teste"); assert.deepEqual(Object.keys(body), ["client", "contacts", "conversations", "contracts", "proposals", "receivables", "projects", "tasks", "tickets", "files", "briefings", "change_requests", "infrastructure", "activities", "summary"]); assert.equal(body.summary.open_tickets, 0); assert.ok(h.calls.every((x) => x.sql.includes("organization_id"))); });
test("portal com token errado responde 404", async () => { const h = harness(); const response = await request(h, "/api/portal/token-inexistente"); assert.equal(response.status, 404); });
test("portal retorna somente dados do cliente da organização", async () => { const h = harness(); const response = await request(h, "/api/portal/valid-token"); assert.equal(response.status, 200); const body = await response.json(); assert.equal(body.client.name, "Cliente teste"); assert.deepEqual(Object.keys(body), ["client", "contracts", "receivables", "projects", "tickets"]); assert.ok(h.calls.filter((x) => x.sql.includes("organization_id")).length >= 5); });
test("GET CEP invalid responds 400", async () => { const h = harness(); const response = await request(h, "/api/cep/123"); assert.equal(response.status, 400); });
test("normaliza os campos retornados pela BrasilAPI", () => { const data = pickCnpj({ razao_social: "Empresa Ltda", nome_fantasia: "Empresa", situacao_cadastral: "ATIVA", data_inicio_atividade: "2020-01-02", cnae_fiscal: 6201, ddd_telefone_1: "1133334444", logradouro: "Rua A", numero: "10" }, "11222333000181"); assert.equal(data.situacao, "ATIVA"); assert.equal(data.abertura, "2020-01-02"); assert.equal(data.cnae, 6201); assert.equal(data.telefone, "1133334444"); assert.equal(data.logradouro, "Rua A"); });
test("listagem de contatos aplica busca, filtros, paginação e workspace", async () => {
  const h = harness();
  const response = await request(h, "/api/contacts?search=ana&company_id=5&limit=10&offset=2");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, { contacts: [], pagination: { limit: 10, offset: 2, returned: 0 } });
  const call = h.calls.at(-1);
  assert.match(call.sql, /contacts\.organization_id=\$1/);
  assert.match(call.sql, /contacts\.company_id=\$3/);
  assert.deepEqual(call.params, [org, "%ana%", "5", 10, 2]);
});

test("cadastro cliente-first aceita apenas o básico e cria vínculos opcionais", async () => {
  const state = { clients: [], nextCompany: 20, nextContact: 30, nextClient: 40 };
  const pool = { query: async (sql, params) => {
    if (sql.startsWith("select id from companies where organization_id=$1 and lower(trim(name))")) return { rowCount: 0, rows: [] };
    if (sql.startsWith("insert into companies")) return { rowCount: 1, rows: [{ id: state.nextCompany++ }] };
    if (sql.startsWith("select id from contacts where organization_id=$1")) return { rowCount: 0, rows: [] };
    if (sql.startsWith("insert into contacts")) return { rowCount: 1, rows: [{ id: state.nextContact++ }] };
    if (sql.startsWith("select id from clients where organization_id=$1")) {
      const client = state.clients.find((item) => (params[1] && item.email === params[1]) || (params[2] && item.phone === params[2]));
      return { rowCount: client ? 1 : 0, rows: client ? [client] : [] };
    }
    if (sql.startsWith("insert into clients")) {
      const client = { id: state.nextClient++, name: params[3], document: params[4], email: params[5], phone: params[6], status: params[7] };
      state.clients.push(client);
      return { rowCount: 1, rows: [client] };
    }
    return { rowCount: 0, rows: [] };
  } };
  const app = express(); app.use(express.json()); register(app, { pool, tenant: () => org, asText: (v) => typeof v === "string" ? v.trim() : "", classifyDbError: () => ({ status: 503, error: "erro" }) });
  const first = await request({ app }, "/api/clients/quick", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Ana", email: "ana@example.com", company_name: "Empresa Ana" }) });
  assert.equal(first.status, 201);
  assert.equal((await first.json()).created, true);
  assert.equal(state.clients.length, 1);
  const duplicate = await request({ app }, "/api/clients/quick", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Ana duplicada", email: "ana@example.com" }) });
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json()).created, false);
  assert.equal(state.clients.length, 1);
});

test("listagem de clientes oculta dados financeiros e observacoes internas", async () => {
  const app = express(); app.use(express.json());
  const pool = { query: async () => ({ rowCount: 1, rows: [{ id: 9, name: "Cliente", pix_key: "segredo", invoice_data: { cpf: "123" }, internal_notes: "restrito" }] }) };
  register(app, { pool, tenant: () => org, asText: (v) => typeof v === "string" ? v.trim() : "", classifyDbError: () => ({ status: 503, error: "erro" }) });
  const response = await request({ app }, "/api/clients"); const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.clients[0].name, "Cliente"); assert.equal("pix_key" in body.clients[0], false); assert.equal("invoice_data" in body.clients[0], false); assert.equal("internal_notes" in body.clients[0], false);
});
