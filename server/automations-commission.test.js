import test from "node:test";
import assert from "node:assert/strict";
import { runAutomationCycle } from "./automations-runner.js";

test("calcula comissão quando freelancer finaliza projeto", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith("select * from automations")) return { rows: [{ id: 8, organization_id: "org", trigger: "freelancer_project_finished", action: "calculate_commission", config: { rate: 10, user_id: "freelancer" } }] };
      if (sql.startsWith("select s.* from projects")) return { rows: [{ id: 4, name: "Landing", status: "completed", total_value: "3000.00", responsible: "Freelancer" }] };
      if (sql.startsWith("select id from users")) return { rowCount: 1, rows: [{ id: "freelancer" }] };
      if (sql.startsWith("insert into automation_runs")) return { rowCount: 1, rows: [{ id: 10 }] };
      if (sql.startsWith("insert into commissions")) return { rowCount: 1, rows: [{ id: 20, amount: "300.00" }] };
      return { rowCount: 1, rows: [] };
    },
    release() {},
  };
  assert.equal(await runAutomationCycle({ connect: async () => client }, new Date("2026-09-14T12:00:00Z")), 1);
  const commission = calls.find((call) => call.sql.startsWith("insert into commissions"));
  assert.equal(commission.params[7], 300);
  assert.equal(commission.params[8], 8);
});
