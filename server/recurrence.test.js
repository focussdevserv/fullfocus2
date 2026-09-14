import test from "node:test";
import assert from "node:assert/strict";
import { addMonths, expandRecurringEvents, nextOccurrence } from "./recurrence.js";

test("avança recorrências diárias e semanais", () => {
  const start = new Date("2026-09-13T10:00:00Z");
  assert.equal(nextOccurrence(start, "daily").toISOString(), "2026-09-14T10:00:00.000Z");
  assert.equal(nextOccurrence(start, "weekly").toISOString(), "2026-09-20T10:00:00.000Z");
});

test("preserva o último dia válido em recorrência mensal", () => {
  assert.equal(addMonths(new Date("2026-01-31T10:00:00Z"), 1).toISOString(), "2026-02-28T10:00:00.000Z");
});

test("expande eventos recorrentes no intervalo e ordena as ocorrências", () => {
  const events = expandRecurringEvents([{ id: 4, title: "Daily", starts_at: "2026-09-14T10:00:00Z", recurrence: "daily" }], { from: new Date("2026-09-13T00:00:00Z"), months: 1 });
  assert.equal(events.length, 29);
  assert.equal(events[0].source_id, 4);
  assert.equal(events[0].starts_at, "2026-09-14T10:00:00.000Z");
  assert.ok(new Date(events.at(-1).starts_at) > new Date(events[0].starts_at));
});
