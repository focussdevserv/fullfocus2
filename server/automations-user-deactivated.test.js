import test from "node:test";
import assert from "node:assert/strict";
import { runAutomationCycle } from "./automations-runner.js";

test("encerra o acesso quando um evento de usuário desativado é processado", async () => {
  const calls = [];
  const client = { async query(sql, params) {
    calls.push({ sql, params });
    if (sql.startsWith("select * from automations")) return { rows: [{ id: 33, organization_id: "org", trigger: "user_deactivated", action: "revoke_access", config: {} }] };
    if (sql.startsWith("select s.*,u.name member_name,u.manager_id,u.email")) return { rows: [{ id: 34, user_id: "member", member_name: "Ana", access_status: "inactive" }] };
    if (sql.startsWith("insert into automation_runs")) return { rowCount: 1, rows: [{ id: 35 }] };
    if (sql.startsWith("update users set access_status='inactive'")) return { rowCount: 1, rows: [{ id: "member" }] };
    return { rowCount: 1, rows: [] };
  }, release() {} };

  assert.equal(await runAutomationCycle({ connect: async () => client }, new Date("2026-09-14T12:00:00Z")), 1);
  const revoke = calls.find((call) => call.sql.startsWith("update users set access_status='inactive'"));
  assert.deepEqual(revoke.params, ["member", "org"]);
});
