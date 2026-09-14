import test from "node:test";
import assert from "node:assert/strict";
import { eventFields, recurrenceValues } from "./events.js";

test("event routes expose all persisted event fields and yearly recurrence", () => {
  for (const field of ["ends_at", "client_id", "project_id", "contract_id", "reminder_channels", "recurrence_until"]) assert.ok(eventFields.includes(field));
  assert.ok(recurrenceValues.includes("yearly"));
});
