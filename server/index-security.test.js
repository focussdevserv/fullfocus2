import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

process.env.NODE_ENV = "test";
const { app, pool } = await import("./index.js");

const listen = async (t) => {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  return (path, options) => fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
};

test("static serve apenas arquivos públicos allowlisted", async (t) => {
  const request = await listen(t);
  assert.equal((await request("/")).status, 200);
  assert.equal((await request("/styles.css")).status, 200);
  assert.equal((await request("/server/index.js")).status, 404);
  assert.equal((await request("/scripts/check.mjs")).status, 404);
  assert.equal((await request("/package.json")).status, 404);
  assert.equal((await request("/static.local.out.log")).status, 404);
});

test("rota pública explícita continua acessível sem sessão", async (t) => {
  const originalQuery = pool.query;
  pool.query = async (sql) => sql.includes("from forms where public_token")
    ? { rowCount: 1, rows: [{ id: 1, name: "Contato", kind: "contact", schema: [], status: "published" }] }
    : { rowCount: 0, rows: [] };
  t.after(() => { pool.query = originalQuery; });
  const request = await listen(t);
  const response = await request("/api/forms/public/token-publico");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).form.name, "Contato");
});
