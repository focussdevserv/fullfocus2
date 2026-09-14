import test from "node:test";
import assert from "node:assert/strict";
import { expandRecurringEvents, nextOccurrence } from "./recurrence.js";

test("expande recorrência anual e respeita a data final", () => {
  const start = new Date("2026-09-13T10:00:00Z");
  assert.equal(nextOccurrence(start, "yearly").toISOString(), "2027-09-13T10:00:00.000Z");
  const events = expandRecurringEvents([{ id: 8, starts_at: "2026-09-13T10:00:00Z", recurrence: "yearly", recurrence_until: "2027-09-13" }], { from: new Date("2026-01-01T00:00:00Z"), months: 24 });
  assert.equal(events.length, 2);
});
