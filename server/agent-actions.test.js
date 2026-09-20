import test from "node:test";
import assert from "node:assert/strict";
import { availableAgentActions, evaluateAgentAction, executeAgentAction } from "./agent-actions.js";

test("autonomia 0 bloqueia mutações mesmo para owner", () => {
  const result = evaluateAgentAction({ action: "create_task", autonomyLevel: 0, role: "owner" });
  assert.deepEqual({ allowed: result.allowed, reason: result.reason }, { allowed: false, reason: "response_only" });
  assert.deepEqual(availableAgentActions({ autonomyLevel: 0, role: "owner" }), []);
});

test("autonomia 1 permite somente rascunho e não tarefa, CRM ou cobrança", () => {
  assert.equal(evaluateAgentAction({ action: "draft_email", autonomyLevel: 1, role: "owner" }).allowed, true);
  for (const action of ["create_task", "update_lead", "prepare_payment"]) {
    const result = evaluateAgentAction({ action, autonomyLevel: 1, role: "owner" });
    assert.equal(result.allowed, false);
    assert.equal(result.reason, "draft_only");
  }
});

test("cargo comum precisa da permissão da ação real", () => {
  const permissions = { tasks: { create: true }, leads: { edit: false } };
  assert.equal(evaluateAgentAction({ action: "criar_tarefa", autonomyLevel: 2, role: "member", permissions }).allowed, true);
  assert.equal(evaluateAgentAction({ action: "update_lead", autonomyLevel: 3, role: "member", permissions }).reason, "permission_denied");
  assert.equal(evaluateAgentAction({ action: "delete_user", autonomyLevel: 4, role: "owner" }).reason, "action_not_allowed");
});

test("executor mantém o tenant na escrita", async () => {
  const calls = [];
  const pool = { query: async (sql, params) => { calls.push({ sql, params }); return { rowCount: 1, rows: [{ id: 9, title: params[1], status: "todo" }] }; } };
  const result = await executeAgentAction({ pool, action: "task_create", payload: { title: "Revisar proposta" }, org: "org-a", userId: "user-a", authorized: true });
  assert.equal(result.executed, true);
  assert.equal(calls[0].params[0], "org-a");
  assert.match(calls[0].sql, /organization_id/);
});
