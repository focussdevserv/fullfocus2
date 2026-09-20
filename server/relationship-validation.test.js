import test from "node:test";
import assert from "node:assert/strict";
import { validateCoherentRelations } from "./relationship-validation.js";

test("rejeita relações de clientes diferentes no mesmo workspace", async () => {
  const pool = { query: async (sql, [id]) => ({ rowCount: 1, rows: [{ id, client_id: sql.includes("from clients") ? id : 8 }] }) };
  await assert.rejects(
    validateCoherentRelations(pool, { client_id: 7, project_id: 9 }, "org-a"),
    (error) => error.code === "invalid_relation" && error.field === "project_id"
  );
});

test("aceita relações coerentes e não consulta com uma única relação", async () => {
  let calls = 0;
  const pool = { query: async () => { calls += 1; return { rowCount: 1, rows: [{ id: 7, client_id: 7 }] }; } };
  await validateCoherentRelations(pool, { client_id: 7, project_id: 9 }, "org-a");
  assert.equal(calls, 2);
  calls = 0;
  await validateCoherentRelations(pool, { project_id: 9 }, "org-a");
  assert.equal(calls, 0);
});
