import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { register } from "./events.js";

test("lista de eventos aplica período e vínculos no workspace", async (t) => {
  const calls = [];
  const pool = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [], rowCount: 0 }; } };
  const app = express();
  register(app, { pool, tenant: () => "org-a", classifyDbError: (_error, message) => ({ status: 503, error: message }), validateRelations: async () => {} });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/events?from=2026-09-01&to=2026-10-01&client_id=7&status=pending`);
  assert.equal(response.status, 200);
  assert.match(calls[0].sql, /starts_at >= \$2/);
  assert.match(calls[0].sql, /starts_at < \$3/);
  assert.match(calls[0].sql, /client_id=\$4/);
  assert.match(calls[0].sql, /status=\$5/);
  assert.deepEqual(calls[0].params, ["org-a", "2026-09-01", "2026-10-01", "7", "pending"]);
});
