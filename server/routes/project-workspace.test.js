import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { register } from "./project-workspace.js";

test("workspace do projeto agrega áreas relacionadas no mesmo tenant", async (t) => {
  const calls = [];
  const pool = { query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes("from projects")) return { rowCount: 1, rows: [{ id: 7, organization_id: "org-a", name: "Site" }] };
    if (sql.includes("from tasks")) return { rowCount: 1, rows: [{ id: 1, title: "Layout", status: "done" }] };
    if (sql.includes("from deliveries")) return { rowCount: 1, rows: [{ id: 2, version: "v1", status: "published" }] };
    if (sql.includes("from tickets")) return { rowCount: 1, rows: [{ id: 3, title: "Dúvida", status: "open" }] };
    return { rowCount: 0, rows: [] };
  } };
  const app = express();
  register(app, { pool, tenant: () => "org-a", classifyDbError: (_error, fallback) => ({ status: 500, error: fallback }) });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/projects/7/workspace`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.project.name, "Site");
  assert.equal(body.tasks[0].title, "Layout");
  assert.equal(body.deliveries[0].version, "v1");
  assert.equal(body.tickets[0].title, "Dúvida");
  assert.ok(calls.every(({ params }) => params[1] === "org-a"));
});
