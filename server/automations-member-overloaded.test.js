import test from "node:test";
import assert from "node:assert/strict";
import { runAutomationCycle } from "./automations-runner.js";

test("lembra o gestor quando um membro estÃ¡ sobrecarregado", async () => {
  const calls = [];
  const client = { async query(sql, params) {
    calls.push({ sql, params });
    if (sql.startsWith("select * from automations")) return { rows: [{ id: 25, organization_id: "org", trigger: "member_overloaded", action: "notify_responsible", config: {} }] };
    if (sql.startsWith("select s.*,(select count(*)")) return { rows: [{ id: "member", manager_id: "manager", name: "Ana", open_tasks: 6 }] };
    if (sql.startsWith("insert into automation_runs")) return { rowCount: 1, rows: [{ id: 26 }] };
    if (sql.startsWith("select id from users where id=$1")) return { rowCount: 1, rows: [{ id: "manager" }] };
    return { rowCount: 1, rows: [] };
  }, release() {} };

  assert.equal(await runAutomationCycle({ connect: async () => client }, new Date("2026-09-14T12:00:00Z")), 1);
  const notification = calls.find((call) => call.sql.startsWith("insert into notifications"));
  assert.deepEqual(notification.params, ["org", "manager", 25, "Membro sobrecarregado: Ana (6 tarefas abertas)"]);
});
