import test from "node:test";
import assert from "node:assert/strict";
import { runAutomationCycle } from "./automations-runner.js";

test("executa uma automação de notificação uma única vez por origem", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith("select * from automations")) return { rows: [{ id: 3, organization_id: "org", trigger: "lead_created", action: "notify", config: {} }] };
      if (sql.startsWith("select s.* from leads")) return { rows: [{ id: 9, name: "Lead novo" }] };
      if (sql.startsWith("insert into automation_runs")) return { rowCount: 1, rows: [{ id: 12 }] };
      if (sql.startsWith("select id from users")) return { rowCount: 1, rows: [{ id: "user" }] };
      return { rowCount: 1, rows: [] };
    },
    release() {},
  };
  const processed = await runAutomationCycle({ connect: async () => client }, new Date("2026-09-14T12:00:00Z"));
  assert.equal(processed, 1);
  assert.equal(calls.filter((call) => call.sql.startsWith("insert into notifications")).length, 1);
  assert.match(calls.find((call) => call.sql.startsWith("update automation_runs")).params[0].message, /Lead novo/);
});
