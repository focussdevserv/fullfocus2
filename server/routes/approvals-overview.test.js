import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { register } from "./approvals-overview.js";

test("visão de aprovações consolida pendências do workspace", async (t) => {
  const calls = [];
  const pool = { query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes("from proposals")) return { rowCount: 1, rows: [{ id: 1, title: "Site", status: "sent" }] };
    if (sql.includes("from deliveries")) return { rowCount: 1, rows: [{ id: 2, version: "v1" }] };
    return { rowCount: 0, rows: [] };
  } };
  const app = express();
  register(app, { pool, tenant: () => "org-a", classifyDbError: (_error, fallback) => ({ status: 500, error: fallback }) });
  const server = createServer(app); await new Promise((resolve) => server.listen(0, resolve)); t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/approvals/overview`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.proposals[0].title, "Site");
  assert.equal(body.deliveries[0].version, "v1");
  assert.ok(calls.length === 5 && calls.every(({ params }) => params[0] === "org-a"));
});
