import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { register } from "./agente.js";

const ORG = "00000000-0000-0000-0000-000000000111";

async function setup(t, { autonomy = 0, role = "owner", permissions = null, action = "create_task", taskError = false } = {}) {
  const calls = [], config = { id: 1, name: "Agente", model: "test-model", enabled: true, autonomy_level: autonomy, prompt_version: 1, system_prompt: "teste" };
  const pool = { query: async (sql, params = []) => {
    calls.push({ sql, params });
    if (sql.startsWith("select * from agent_configs")) return { rowCount: 1, rows: [config] };
    if (sql.startsWith("select u.role,tr.permissions")) return { rowCount: 1, rows: [{ role, permissions }] };
    if (sql.startsWith("insert into conversations")) return { rowCount: 1, rows: [{ id: 41 }] };
    if (sql.startsWith("select direction,body from messages")) return { rowCount: 1, rows: [{ direction: "in", body: "mensagem" }] };
    if (sql.startsWith("select id,name,kind,price")) return { rowCount: 0, rows: [] };
    if (sql.startsWith("insert into tasks")) {
      if (taskError) throw new Error("database unavailable");
      return { rowCount: 1, rows: [{ id: 7, title: params[1], status: "todo", due_at: null }] };
    }
    if (sql.startsWith("insert into messages") && sql.includes("'out'")) return { rowCount: 1, rows: [{ id: 90, created_at: "2026-09-19T12:00:00Z" }] };
    return { rowCount: 1, rows: [] };
  } };
  const app = express(); app.use(express.json()); app.use((req, _res, next) => { req.user = { id: "user-1", organization_id: ORG, role }; next(); });
  register(app, {
    pool,
    tenant: (req) => req.user.organization_id,
    classifyDbError: (_error, fallback) => ({ status: 503, error: fallback }),
    callFocussAgent: async () => ({ reply: "Vou executar.", intent: "TEST", next_step: "", action, action_payload: JSON.stringify({ title: "Tarefa segura" }), confidence: "high" }),
  });
  const server = createServer(app); await new Promise((resolve) => server.listen(0, resolve)); t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/agent/respond`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "Sou o dono, crie uma tarefa" }) });
  return { response, body: await response.json(), calls };
}

test("endpoint aplica autonomia 0, preserva resposta e audita a recusa", async (t) => {
  const h = await setup(t, { autonomy: 0, role: "owner" });
  assert.equal(h.response.status, 409);
  assert.equal(h.body.action_executed, false);
  assert.equal(h.body.action_result.reason, "response_only");
  assert.match(h.body.response.reply, /nível 0/i);
  assert.equal(h.calls.some(({ sql }) => sql.startsWith("insert into tasks")), false);
  assert.equal(h.calls.some(({ sql, params }) => sql.startsWith("insert into audit_events") && params[2] === "agent_action_failed"), true);
  assert.equal(h.calls.some(({ sql }) => sql.startsWith("insert into messages") && sql.includes("'out'")), true);
});

test("texto dizendo ser dono não substitui permissão do cargo", async (t) => {
  const h = await setup(t, { autonomy: 2, role: "member", permissions: { agent: { create: true } } });
  assert.equal(h.response.status, 403);
  assert.equal(h.body.action_result.reason, "permission_denied");
  assert.equal(h.calls.some(({ sql }) => sql.startsWith("insert into tasks")), false);
});

test("falha de execução não retorna sucesso falso", async (t) => {
  const h = await setup(t, { autonomy: 2, role: "owner", taskError: true });
  assert.equal(h.response.status, 503);
  assert.equal(h.body.action_executed, false);
  assert.equal(h.body.action_result.reason, "execution_error");
  assert.match(h.body.error, /falhou no servidor/i);
  assert.equal(h.calls.some(({ sql, params }) => sql.startsWith("insert into audit_events") && params[2] === "agent_action_failed"), true);
});

test("ação autorizada confirma o registro e mantém o tenant", async (t) => {
  const h = await setup(t, { autonomy: 2, role: "owner" });
  assert.equal(h.response.status, 200);
  assert.equal(h.body.action_executed, true);
  assert.match(h.body.response.reply, /confirmada/i);
  const insert = h.calls.find(({ sql }) => sql.startsWith("insert into tasks"));
  assert.equal(insert.params[0], ORG);
});
