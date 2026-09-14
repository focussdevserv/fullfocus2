import test from "node:test";
import assert from "node:assert/strict";
import { runAutomationCycle, runSubscriptionBillingCycle } from "./automations-runner.js";

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

test("gera recebível de assinatura vencida e avança o período", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith("select * from subscriptions")) return { rows: [{ id: 4, organization_id: "org", client_id: 8, plan: "Pro", amount: "99.90", interval: "monthly", next_billing_on: "2026-09-01" }] };
      if (sql.startsWith("insert into receivables")) return { rowCount: 1, rows: [{ id: 21 }] };
      return { rowCount: 1, rows: [] };
    },
    release() {},
  };
  assert.equal(await runSubscriptionBillingCycle({ connect: async () => client }, new Date("2026-09-14")), 1);
  assert.equal(calls.filter((call) => call.sql.startsWith("insert into receivables")).length, 1);
  assert.match(calls.find((call) => call.sql.startsWith("update subscriptions")).sql, /1 month/);
});

test("envia automação WhatsApp para o telefone da origem", async () => {
  const calls = []; const sent = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith("select * from automations")) return { rows: [{ id: 5, organization_id: "org", trigger: "lead_created", action: "send_message", config: { channel: "whatsapp", body: "Olá lead" } }] };
      if (sql.startsWith("select s.* from leads")) return { rows: [{ id: 10, name: "Lead WhatsApp", phone: "+55 (11) 99999-0000" }] };
      if (sql.startsWith("insert into automation_runs")) return { rowCount: 1, rows: [{ id: 13 }] };
      return { rowCount: 1, rows: [] };
    }, release() {},
  };
  const processed = await runAutomationCycle({ connect: async () => client }, new Date("2026-09-14T12:00:00Z"), {
    sendWhatsApp: async (...args) => { sent.push(args); return { id: "msg-1" }; },
  });
  assert.equal(processed, 1);
  assert.deepEqual(sent[0].slice(1), ["org", "5511999990000", "Olá lead"]);
});
