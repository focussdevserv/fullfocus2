import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { createResetToken, hashResetToken, isExpired, attachResetRoutes } from "./auth-reset.js";

test("cria tokens aleatórios de 32 bytes e hash compatível", () => {
  const first = createResetToken();
  const second = createResetToken();
  assert.equal(Buffer.from(first.token, "base64url").length, 32);
  assert.notEqual(first.token, second.token);
  assert.equal(first.tokenHash, hashResetToken(first.token));
  assert.match(first.tokenHash, /^[a-f0-9]{64}$/);
});

test("identifica expiração antes e depois do vencimento", () => {
  const expires = Date.parse("2026-09-14T12:00:00Z");
  assert.equal(isExpired(expires, expires - 1), false);
  assert.equal(isExpired(expires, expires), true);
  assert.equal(isExpired(expires, expires + 1), true);
});

test("reset-request responde 202 para e-mail inexistente e token inválido responde 400", async (t) => {
  const calls = [];
  const pool = { connect: async () => ({ query: async (sql) => { calls.push(sql); if (sql.startsWith("select id,email")) return { rows: [] }; return { rows: [] }; }, release() {} }) };
  const app = express();
  app.use(express.json());
  attachResetRoutes(app, { pool, hashPassword: () => ({ salt: "salt", hash: "hash" }), logger: { info() {}, error() {} } });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  const address = server.address();
  const request = (path, body) => fetch(`http://127.0.0.1:${address.port}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const unknown = await request("/api/auth/reset-request", { email: "nao-existe@example.com" });
  assert.equal(unknown.status, 202);
  assert.deepEqual(await unknown.json(), { ok: true });
  const invalid = await request("/api/auth/reset-confirm", { token: "invalid", password: "senha-segura" });
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), { error: "Link invalido ou expirado." });
  assert.ok(calls.some((sql) => sql.startsWith("select id,email")));
});
