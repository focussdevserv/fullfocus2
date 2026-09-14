import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { register } from "./crm.js";

const ORG = "00000000-0000-0000-0000-000000000001";
function setup() {
  const calls = [];
  const pool = { query: async (sql, params) => { calls.push({ sql, params });
    if (sql.startsWith("select * from campaigns")) return { rows: [{ id: 1, organization_id: ORG, name: "C", status: "draft" }] };
    if (sql.startsWith("select p.*")) return { rows: [{ id: 2, organization_id: ORG, title: "P", status: "sent", opportunity_id: 9 }] };
    if (sql.startsWith("update proposals")) return { rowCount: 1, rows: [{ id: 2, opportunity_id: 9, status: params[0] }] };
    if (sql.startsWith("insert into campaigns")) return { rowCount: 1, rows: [{ id: 3, organization_id: ORG, name: params[1] }] };
    if (sql.startsWith("insert into proposals")) return { rowCount: 1, rows: [{ id: 4, organization_id: ORG, title: params[2] }] };
    if (sql.startsWith("select f.*")) return { rows: [{ id: 5, organization_id: ORG, lead_id: 7 }] };
    if (sql.startsWith("insert into followups")) return { rowCount: 1, rows: [{ id: 6, organization_id: ORG, lead_id: params[1] }] };
    return { rowCount: 1, rows: [{ id: 9 }] };
  } };
  const app = express(); app.use(express.json());
  register(app, { pool, tenant: (_req, res) => { res.locals.org = ORG; return ORG; }, asText: v => typeof v === "string" ? v.trim() : "", classifyDbError: (_e, error) => ({ status: 503, error }), validateRelations: async () => {} });
  const server = createServer(app); return { server, calls };
}
async function request(t, path, options = {}) { await new Promise(resolve => t.server.listen(0, resolve)); const port = t.server.address().port; const r = await fetch(`http://127.0.0.1:${port}${path}`, { ...options, headers: { "content-type": "application/json" }, body: options.body ? JSON.stringify(options.body) : undefined }); t.server.close(); return r; }

test("campaigns lista filtrada por organização", async () => { const t = setup(); const r = await request(t, "/api/campaigns"); assert.equal(r.status, 200); assert.equal(t.calls[0].params[0], ORG); });
test("campaign válida responde 201", async () => { const r = await request(setup(), "/api/campaigns", { method: "POST", body: { name: "Nova", channel: "email", budget: 10 } }); assert.equal(r.status, 201); });
test("campaign inválida responde 400", async () => { const r = await request(setup(), "/api/campaigns", { method: "POST", body: { name: "", channel: "email", budget: -1 } }); assert.equal(r.status, 400); });
test("proposals lista filtrada por organização", async () => { const t = setup(); const r = await request(t, "/api/proposals"); assert.equal(r.status, 200); assert.equal(t.calls[0].params[0], ORG); });
test("proposal válida responde 201 e inválida 400", async () => { const good = await request(setup(), "/api/proposals", { method: "POST", body: { title: "P", amount: 20 } }); assert.equal(good.status, 201); const bad = await request(setup(), "/api/proposals", { method: "POST", body: { title: "", amount: -2 } }); assert.equal(bad.status, 400); });
test("followups lista e criação filtram organização", async () => { const t = setup(); assert.equal((await request(t, "/api/followups")).status, 200); assert.equal(t.calls[0].params[0], ORG); const r = await request(setup(), "/api/followups", { method: "POST", body: { lead_id: 7, due_at: "2026-09-15T10:00:00Z" } }); assert.equal(r.status, 201); });
test("aceitar proposta atualiza oportunidade para won", async () => { const t = setup(); const r = await request(t, "/api/proposals/2", { method: "PATCH", body: { status: "accepted" } }); assert.equal(r.status, 200); assert.ok(t.calls.some(x => x.sql.includes("stage='won'") && x.params[1] === ORG)); });
