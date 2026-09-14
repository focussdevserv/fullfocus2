import test from "node:test";
import assert from "node:assert/strict";
import { buildConversionPlan, calculateForecast, convertWonOpportunity, deduplicateByIdentity, transitionLead, validateLeadData } from "./crm-domain.js";

test("valida identidade e campos essenciais do lead", () => {
  assert.equal(validateLeadData({ name: "Ana", email: "ANA@EXAMPLE.COM" }).valid, true);
  assert.equal(validateLeadData({ name: "Ana" }).valid, false);
  assert.equal(validateLeadData({ name: "Ana", email: "bad" }).errors[0].code, "invalid");
});

test("deduplica por qualquer identidade compartilhada", () => {
  const result = deduplicateByIdentity([{ id: 1, email: "a@x.com" }, { id: 2, phone: "(11) 99999-0000" }, { id: 3, email: "A@X.COM" }, { id: 4, phone: "11999990000" }]);
  assert.deepEqual(result.unique.map(({ id }) => id), [1, 2]);
  assert.deepEqual(result.duplicates.map(({ duplicate }) => duplicate.id), [3, 4]);
});

test("transições cobrem ganho, perda e idempotência", () => {
  const opportunity = transitionLead({ lead: { id: 7, stage: "lead" }, to: "opportunity" });
  const won = transitionLead({ lead: opportunity.entity, to: "won" });
  const lost = transitionLead({ lead: { id: 8, stage: "opportunity" }, to: "lost", reason: "sem orçamento" });
  const repeat = transitionLead({ lead: won.entity, to: "won" });
  assert.equal(won.ok && won.entity.stage, "won");
  assert.equal(lost.entity.stage, "lost");
  assert.equal(repeat.changed, false);
});

test("calcula forecast ponderado por estágio", () => {
  const forecast = calculateForecast([{ stage: "lead", amount: 1000 }, { stage: "opportunity", amount: 2000 }, { stage: "won", amount: 500 }]);
  assert.equal(forecast.totalAmount, 3500);
  assert.equal(forecast.weightedAmount, 1400);
});

test("plano permite selecionar cliente, contrato, projeto, cobrança e tarefa", () => {
  const args = { opportunity: { id: "opp-1" }, selections: { client: true, contract: false, project: true, billing: true, task: false }, ids: { client: "c-1" } };
  const plan = buildConversionPlan(args);
  assert.deepEqual(plan.steps.map((step) => step.type), ["client", "project", "billing"]);
  assert.equal(plan.steps[0].id, "c-1");
  const first = convertWonOpportunity(args);
  const second = convertWonOpportunity({ ...args, existingConversions: [{ idempotencyKey: first.idempotencyKey }] });
  assert.equal(second.alreadyConverted, true);
  assert.equal(second.events.length, 0);
});
