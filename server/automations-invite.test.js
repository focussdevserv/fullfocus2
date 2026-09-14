import test from "node:test";
import assert from "node:assert/strict";
import { runAutomationCycle } from "./automations-runner.js";

test("processa um novo membro convidado uma única vez", async () => {
  const calls = [];
  const client = { async query(sql, params) {
    calls.push({ sql, params });
    if (sql.startsWith("select * from automations")) return { rows: [{ id: 11, organization_id: "org", trigger: "team_member_invited", action: "notify", config: {} }] };
    if (sql.startsWith("select s.* from users")) return { rows: [{ id: 12, name: "Novo membro", email: "novo@example.com" }] };
    if (sql.startsWith("insert into automation_runs")) return { rowCount: 1, rows: [{ id: 13 }] };
    if (sql.startsWith("select id from users")) return { rowCount: 1, rows: [{ id: "admin" }] };
    return { rowCount: 1, rows: [] };
  }, release() {} };
  assert.equal(await runAutomationCycle({ connect: async () => client }, new Date("2026-09-14T12:00:00Z")), 1);
  assert.match(calls.find((call) => call.sql.startsWith("update automation_runs")).params[0].message, /Novo membro/);
});
