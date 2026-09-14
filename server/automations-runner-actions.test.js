import test from "node:test";
import assert from "node:assert/strict";
import { runAutomationCycle } from "./automations-runner.js";

function poolFor(automation, source) {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith("select * from automations")) return { rows: [automation] };
      if (sql.includes("from leads s") || sql.includes("from opportunities s") || sql.includes("from proposals s") || sql.includes("from contracts s") || sql.includes("from projects s") || sql.includes("from tasks s")) return { rows: [source] };
      if (sql.startsWith("select id from leads")) return { rowCount: 1, rows: [{ id: source.id }] };
      if (sql.startsWith("insert into automation_runs")) return { rowCount: 1, rows: [{ id: 90 }] };
      if (sql.startsWith("insert into followups")) return { rowCount: 1, rows: [{ id: 91 }] };
      if (sql.startsWith("insert into receivables")) return { rowCount: 1, rows: [{ id: 92 }] };
      if (sql.startsWith("insert into contracts")) return { rowCount: 1, rows: [{ id: 93 }] };
      if (sql.startsWith("insert into projects")) return { rowCount: 1, rows: [{ id: 94 }] };
      if (sql.startsWith("insert into files")) return { rowCount: 1, rows: [{ id: 95 }] };
      if (sql.startsWith("insert into satisfaction_requests")) return { rowCount: 1, rows: [{ id: 96, token: "token" }] };
      if (sql.startsWith("insert into events")) return { rowCount: 1, rows: [{ id: 97 }] };
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

test("registra documento gerado no acervo de arquivos", async () => {
  const { client, calls } = poolFor({ id: 52, organization_id: "org", trigger: "proposal_approved", action: "generate_document", config: { url: "https://example.com/contract.pdf" } }, { id: 53, title: "Site", client_id: 54 });
  assert.equal(await runAutomationCycle({ connect: async () => client }, new Date("2026-09-14T12:00:00Z")), 1);
  assert.equal(calls.filter((call) => call.sql.startsWith("insert into files")).length, 1);
});

test("cria pesquisa de satisfação vinculada ao projeto concluído", async () => {
  const { client, calls } = poolFor({ id: 55, organization_id: "org", trigger: "project_completed", action: "request_satisfaction", config: {} }, { id: 56, name: "Site", client_id: 57 });
  assert.equal(await runAutomationCycle({ connect: async () => client }, new Date("2026-09-14T12:00:00Z")), 1);
  assert.equal(calls.filter((call) => call.sql.startsWith("insert into satisfaction_requests")).length, 1);
});

test("cria evento de calendário para uma tarefa", async () => {
  const { client, calls } = poolFor({ id: 58, organization_id: "org", trigger: "task_due_soon", action: "create_calendar_event", config: { starts_at: "2026-09-15T14:00:00Z" } }, { id: 59, title: "Revisar entrega" });
  assert.equal(await runAutomationCycle({ connect: async () => client }, new Date("2026-09-14T12:00:00Z")), 1);
  assert.equal(calls.filter((call) => call.sql.startsWith("insert into events")).length, 1);
});

test("move uma oportunidade para a etapa configurada", async () => {
  const { client, calls } = poolFor({ id: 60, organization_id: "org", trigger: "lead_stage_changed", action: "move_pipeline", config: { stage: "proposal" } }, { id: 61, name: "Site" });
  assert.equal(await runAutomationCycle({ connect: async () => client }, new Date("2026-09-14T12:00:00Z")), 1);
  const update = calls.find((call) => call.sql.startsWith("update opportunities set stage"));
  assert.deepEqual(update.params, ["proposal", 61, "org"]);
});

test("encerra uma automação sem executar ações adicionais", async () => {
  const { client, calls } = poolFor({ id: 62, organization_id: "org", trigger: "lead_created", action: "end", config: {} }, { id: 63, name: "Site" });
  assert.equal(await runAutomationCycle({ connect: async () => client }, new Date("2026-09-14T12:00:00Z")), 1);
  assert.equal(calls.some((call) => call.sql.startsWith("insert into notifications")), false);
});

test("atribui responsável a um lead", async () => {
  const { client, calls } = poolFor({ id: 64, organization_id: "org", trigger: "lead_created", action: "assign_owner", config: { user_id: "owner" } }, { id: 65, name: "Site" });
  assert.equal(await runAutomationCycle({ connect: async () => client }, new Date("2026-09-14T12:00:00Z")), 1);
  const update = calls.find((call) => call.sql.startsWith("update leads set owner_id"));
  assert.deepEqual(update.params, ["owner", 65, "org"]);
});

test("adiciona etiqueta sem duplicá-la", async () => {
  const { client, calls } = poolFor({ id: 66, organization_id: "org", trigger: "lead_created", action: "add_tag", config: { tag: "vip" } }, { id: 67, name: "Site" });
  assert.equal(await runAutomationCycle({ connect: async () => client }, new Date("2026-09-14T12:00:00Z")), 1);
  const update = calls.find((call) => call.sql.startsWith("update leads set tags"));
  assert.deepEqual(update.params, ["vip", 67, "org"]);
});
