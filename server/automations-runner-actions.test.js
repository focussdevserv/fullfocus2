import test from "node:test";
import assert from "node:assert/strict";
import { runAutomationCycle } from "./automations-runner.js";

function poolFor(automation, source) {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith("select * from automations")) return { rows: [automation] };
      if (sql.includes("from leads s") || sql.includes("from proposals s") || sql.includes("from contracts s")) return { rows: [source] };
      if (sql.startsWith("select id from leads")) return { rowCount: 1, rows: [{ id: source.id }] };
      if (sql.startsWith("insert into automation_runs")) return { rowCount: 1, rows: [{ id: 90 }] };
      if (sql.startsWith("insert into followups")) return { rowCount: 1, rows: [{ id: 91 }] };
      if (sql.startsWith("insert into receivables")) return { rowCount: 1, rows: [{ id: 92 }] };
      if (sql.startsWith("insert into contracts")) return { rowCount: 1, rows: [{ id: 93 }] };
      if (sql.startsWith("insert into projects")) return { rowCount: 1, rows: [{ id: 94 }] };
      return { rowCount: 1, rows: [] };
    },
    release() {},
  };
  return { client, calls };
}

test("cria follow-up de lead automaticamente", async () => {
  const { client, calls } = poolFor({ id: 40, organization_id: "org", trigger: "lead_created", action: "create_followup", config: {} }, { id: 41, name: "João" });
  assert.equal(await runAutomationCycle({ connect: async () => client }, new Date("2026-09-14T12:00:00Z")), 1);
  assert.equal(calls.filter((call) => call.sql.startsWith("insert into followups")).length, 1);
});

test("cria cobrança com valor da origem", async () => {
  const { client, calls } = poolFor({ id: 42, organization_id: "org", trigger: "lead_created", action: "create_charge", config: {} }, { id: 43, name: "João", value: "2700" });
  assert.equal(await runAutomationCycle({ connect: async () => client }, new Date("2026-09-14T12:00:00Z")), 1);
  const charge = calls.find((call) => call.sql.startsWith("insert into receivables"));
  assert.equal(charge.params[5], 2700);
});

test("altera status somente em tabelas permitidas", async () => {
  const { client, calls } = poolFor({ id: 44, organization_id: "org", trigger: "lead_created", action: "update_status", config: { status: "qualified" } }, { id: 45, name: "João" });
  assert.equal(await runAutomationCycle({ connect: async () => client }, new Date("2026-09-14T12:00:00Z")), 1);
  const update = calls.find((call) => call.sql.startsWith("update leads set status"));
  assert.deepEqual(update.params, ["qualified", 45, "org"]);
});

test("gera contrato quando proposta é aprovada", async () => {
  const { client, calls } = poolFor({ id: 46, organization_id: "org", trigger: "proposal_approved", action: "generate_contract", config: {} }, { id: 47, title: "Site", client_id: 48, amount: "3000" });
  assert.equal(await runAutomationCycle({ connect: async () => client }, new Date("2026-09-14T12:00:00Z")), 1);
  assert.equal(calls.filter((call) => call.sql.startsWith("insert into contracts")).length, 1);
});

test("cria projeto quando contrato é assinado", async () => {
  const { client, calls } = poolFor({ id: 49, organization_id: "org", trigger: "contract_signed", action: "create_project", config: {} }, { id: 50, name: "Site", client_id: 51, value: "3000" });
  assert.equal(await runAutomationCycle({ connect: async () => client }, new Date("2026-09-14T12:00:00Z")), 1);
  assert.equal(calls.filter((call) => call.sql.startsWith("insert into projects")).length, 1);
});
