import test from "node:test";
import assert from "node:assert/strict";
import { runAutomationCycle } from "./automations-runner.js";

test("envia orientacoes ao membro adicionado a um projeto", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith("select * from automations")) return { rows: [{ id: 36, organization_id: "org", trigger: "member_added_to_project", action: "send_onboarding", config: {} }] };
      if (sql.startsWith("select s.*,u.name member_name,u.email,p.name project_name")) return { rows: [{ id: 37, user_id: "member", project_id: 38, member_name: "Ana", email: "ana@example.com", project_name: "Site" }] };
      if (sql.startsWith("insert into automation_runs")) return { rowCount: 1, rows: [{ id: 39 }] };
      return { rowCount: 1, rows: [] };
    },
    release() {},
  };

  assert.equal(await runAutomationCycle({ connect: async () => client }, new Date("2026-09-14T12:00:00Z")), 1);
  assert.equal(calls.filter((call) => call.sql.startsWith("insert into notifications")).length, 1);
});
