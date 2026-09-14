import test from "node:test";
import assert from "node:assert/strict";
import { runAutomationCycle } from "./automations-runner.js";

test("notifica o responsavel quando a tarefa estÃ¡ prÃ³xima do prazo", async () => {
  const calls = [];
  const client = { async query(sql, params) {
    calls.push({ sql, params });
    if (sql.startsWith("select * from automations")) return { rows: [{ id: 22, organization_id: "org", trigger: "task_due_soon", action: "notify", config: {} }] };
    if (sql.startsWith("select s.* from tasks")) return { rows: [{ id: 23, assignee_id: "user", title: "Enviar proposta" }] };
    if (sql.startsWith("insert into automation_runs")) return { rowCount: 1, rows: [{ id: 24 }] };
    if (sql.startsWith("select id from users where id=$1")) return { rowCount: 1, rows: [{ id: "user" }] };
    return { rowCount: 1, rows: [] };
  }, release() {} };

  assert.equal(await runAutomationCycle({ connect: async () => client }, new Date("2026-09-14T12:00:00Z")), 1);
  const notification = calls.find((call) => call.sql.startsWith("insert into notifications"));
  assert.deepEqual(notification.params, ["org", "user", 22, "Tarefa próxima do prazo: Enviar proposta"]);
});
