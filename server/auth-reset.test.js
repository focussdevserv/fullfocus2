import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { createResetToken, hashResetToken, isExpired, attachResetRoutes } from "./auth-reset.js";

const start = async (app, t) => {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  return (path, body) => fetch(`http://127.0.0.1:${server.address().port}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
};

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

test("reset-request não enumera contas, envia fluxo legítimo e não registra token", async (t) => {
  const calls = [], logs = [], mails = [];
  const pool = { connect: async () => ({ query: async (sql, params) => { calls.push({ sql, params }); if (sql.startsWith("select id,email")) return { rows: params[0] === "existe@example.com" ? [{ id: 7, email: params[0] }] : [] }; return { rows: [] }; }, release() {} }) };
  const app = express();
  app.use(express.json());
  attachResetRoutes(app, { pool, hashPassword: () => ({ salt: "salt", hash: "hash" }), logger: { info: (...args) => logs.push(args), error: (...args) => logs.push(args) }, mail: async (message) => { mails.push(message); return { sent: true }; } });
  const request = await start(app, t);
  const unknown = await request("/api/auth/reset-request", { email: "nao-existe@example.com" });
  const known = await request("/api/auth/reset-request", { email: "existe@example.com" });
  assert.equal(unknown.status, 202);
  assert.deepEqual(await unknown.json(), { ok: true });
  assert.equal(known.status, 202);
  assert.deepEqual(await known.json(), { ok: true });
  assert.equal(mails.length, 1);
  const token = mails[0].text.match(/#reset=([A-Za-z0-9_-]+)/)?.[1];
  assert.ok(token);
  assert.ok(calls.some(({ sql, params }) => sql.startsWith("insert into password_resets") && params[1] === hashResetToken(token)));
  assert.equal(JSON.stringify(logs).includes(token), false);
});

test("reset e login aplicam limite por e-mail e respondem 429", async (t) => {
  const pool = { connect: async () => ({ query: async (sql) => sql.startsWith("select id,email") ? { rows: [] } : { rows: [] }, release() {} }) };
  const app = express();
  app.use(express.json());
  app.post("/api/auth/login", (_req, res) => res.status(401).json({ error: "E-mail ou senha inválidos." }));
  attachResetRoutes(app, { pool, hashPassword: () => ({ salt: "salt", hash: "hash" }), logger: { error() {} } });
  const request = await start(app, t);
  for (let i = 0; i < 3; i += 1) assert.equal((await request("/api/auth/reset-request", { email: "alvo@example.com" })).status, 202);
  const limitedReset = await request("/api/auth/reset-request", { email: "alvo@example.com" });
  assert.equal(limitedReset.status, 429);
  assert.ok(limitedReset.headers.get("retry-after"));
  for (let i = 0; i < 5; i += 1) assert.equal((await request("/api/auth/login", { email: "login@example.com", password: "errada" })).status, 401);
  assert.equal((await request("/api/auth/login", { email: "login@example.com", password: "errada" })).status, 429);
});

test("reset-confirm consome token uma única vez e revoga sessões", async (t) => {
  let available = true;
  const calls = [];
  const pool = { connect: async () => ({ query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.startsWith("select user_id")) return { rows: available ? [{ user_id: 42 }] : [] };
    if (sql.startsWith("update password_resets set used_at") && sql.includes("user_id")) available = false;
    return { rows: [] };
  }, release() {} }) };
  const app = express();
  app.use(express.json());
  attachResetRoutes(app, { pool, hashPassword: () => ({ salt: "new-salt", hash: "new-hash" }), logger: { error() {} } });
  const request = await start(app, t);
  const first = await request("/api/auth/reset-confirm", { token: "valid-token", password: "senha-segura" });
  assert.equal(first.status, 204);
  assert.match(first.headers.get("set-cookie"), /Max-Age=0/);
  assert.ok(calls.some(({ sql, params }) => sql.startsWith("update users set password_hash") && sql.includes("access_revoked_at=now()") && params[1] === 42));
  assert.ok(calls.some(({ sql, params }) => sql.startsWith("update password_resets set used_at") && sql.includes("user_id") && params[0] === 42));
  const replay = await request("/api/auth/reset-confirm", { token: "valid-token", password: "senha-segura" });
  assert.equal(replay.status, 400);
  assert.deepEqual(await replay.json(), { error: "Link invalido ou expirado." });
});
