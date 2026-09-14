import test from "node:test";
import assert from "node:assert/strict";
import { runAutomationCycle } from "./automations-runner.js";

test("reatribui atendimentos abertos quando a venda Ã© concluÃ­da", async () => {
  const calls = [];
  const client = { async query(sql, params) {
    calls.push({ sql, params });
    if (sql.startsWith("select * from automations")) return { rows: [{ id: 30, organization_id: "org", trigger: "sale_won", action: "reassign_support", config: { user_id: "support" } }] };
    if (sql.startsWith("select s.*,(select c.id")) return { rows: [{ id: 31, contact_id: 40, client_id: 41, stage: "won" }] };
    if (sql.startsWith("insert into automation_runs")) return { rowCount: 1, rows: [{ id: 32 }] };
    if (sql.startsWith("select id from users where id=$1")) return { rowCount: 1, rows: [{ id: "support" }] };
    if (sql.startsWith("update tickets set assignee_id")) return { rowCount: 2, rows: [] };
    return { rowCount: 1, rows: [] };
  }, release() {} };

  assert.equal(await runAutomationCycle({ connect: async () => client }, new Date("2026-09-14T12:00:00Z")), 1);
  const update = calls.find((call) => call.sql.startsWith("update tickets set assignee_id"));
  assert.deepEqual(update.params, ["support", "org", 41]);
});
