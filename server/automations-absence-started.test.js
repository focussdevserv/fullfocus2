import test from "node:test";
import assert from "node:assert/strict";
import { runAutomationCycle } from "./automations-runner.js";

test("avisa o gestor quando as fÃ©rias de um membro comeÃ§am", async () => {
  const calls = [];
  const client = { async query(sql, params) {
    calls.push({ sql, params });
    if (sql.startsWith("select * from automations")) return { rows: [{ id: 27, organization_id: "org", trigger: "absence_started", action: "notify_responsible", config: {} }] };
    if (sql.startsWith("select s.*,u.name member_name,u.manager_id")) return { rows: [{ id: 28, user_id: "member", manager_id: "manager", member_name: "Ana", kind: "vacation" }] };
    if (sql.startsWith("insert into automation_runs")) return { rowCount: 1, rows: [{ id: 29 }] };
    if (sql.startsWith("select id from users where id=$1")) return { rowCount: 1, rows: [{ id: "manager" }] };
    return { rowCount: 1, rows: [] };
  }, release() {} };

  assert.equal(await runAutomationCycle({ connect: async () => client }, new Date("2026-09-14T12:00:00Z")), 1);
  const notification = calls.find((call) => call.sql.startsWith("insert into notifications"));
  assert.deepEqual(notification.params, ["org", "manager", 27, "F\u00e9rias iniciadas: Ana"]);
});
