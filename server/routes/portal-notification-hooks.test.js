import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { register } from "./portal-notification-hooks.js";

test("vincula ticket criado no portal à notificação interna", async () => {
  const calls = [], pool = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [], rowCount: 1 }; } };
  const app = express(); app.use(express.json()); register(app, { pool }); app.post("/api/portal/:token/tickets", (_req, res) => res.status(201).json({ ticket: { id: 42 } }));
  const server = createServer(app); await new Promise((resolve) => server.listen(0, resolve)); const port = server.address().port; const response = await fetch(`http://127.0.0.1:${port}/api/portal/token/tickets`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); await new Promise((resolve) => setImmediate(resolve)); server.close(); assert.equal(response.status, 201); assert.equal(calls.length, 1); assert.deepEqual(calls[0].params.slice(1), ["Novo ticket aberto pelo cliente", "tickets", 42]);
});
