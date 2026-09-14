import test from "node:test";
import assert from "node:assert/strict";
import { runAutomationCycle } from "./automations-runner.js";

test("libera o projeto quando uma tarefa é atribuída", async () => {
  const calls = [];
  const client = { async query(sql, params) {
    calls.push({ sql, params });
    if (sql.startsWith("select * from automations")) return { rows: [{ id: 18, organization_id: "org", trigger: "task_assigned", action: "grant_project_access", config: {} }] };
    if (sql.startsWith("select s.*,u.name")) return { rows: [{ id: 19, project_id: 20, assignee_id: "user", title: "Implementar tela" }] };
    if (sql.startsWith("insert into automation_runs")) return { rowCount: 1, rows: [{ id: 21 }] };
    return { rowCount: 1, rows: [] };
  }, release() {} };
  assert.equal(await runAutomationCycle({ connect: async () => client }, new Date("2026-09-14T12:00:00Z")), 1);
  assert.equal(calls.filter((call) => call.sql.startsWith("insert into project_members")).length, 1);
  assert.equal(calls.filter((call) => call.sql.startsWith("insert into notifications")).length, 1);
});
