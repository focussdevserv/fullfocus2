import test from "node:test";
import assert from "node:assert/strict";
import { FIELDS } from "./catalogo.js";

test("catalog route uses only columns represented by the catalog migrations", () => {
  for (const field of ["full_description", "delivery_days", "modules_count", "revisions_count", "entry_price"]) assert.ok(FIELDS.includes(field), `missing ${field}`);
  for (const obsolete of ["long_description", "delivery_time", "pages_or_modules", "revisions_included", "entry_value"]) assert.equal(FIELDS.includes(obsolete), false, `obsolete ${obsolete}`);
});
