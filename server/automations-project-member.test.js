import test from "node:test";
import assert from "node:assert/strict";
import { runAutomationCycle } from "./automations-runner.js";

test("libera arquivos e tarefas ao adicionar membro a projeto", async () => {
  const calls = [];
  const client = { async query(sql, params) {
    calls.push({ sql, params });
    if (sql.startsWith("select * from automations")) return { rows: [{ id: 14, organization_id: "org", trigger: "member_added_to_project", action: "grant_project_access", config: {} }] };
    if (sql.startsWith("select s.*,u.name")) return { rows: [{ id: 15, user_id: "user", project_id: 16, project_name: "Website" }] };
    if (sql.startsWith("insert into automation_runs")) return { rowCount: 1, rows: [{ id: 17 }] };
    return { rowCount: 1, rows: [] };
  }, release() {} };
  assert.equal(await runAutomationCycle({ connect: async () => client }, new Date("2026-09-14T12:00:00Z")), 1);
  assert.equal(calls.filter((call) => call.sql.startsWith("update project_members")).length, 1);
  assert.equal(calls.filter((call) => call.sql.startsWith("insert into notifications")).length, 1);
});
