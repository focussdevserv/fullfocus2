import test from "node:test";
import assert from "node:assert/strict";
import { sendEmail, renderEmail, mailerStatus } from "./mailer.js";

test("mailerStatus reflete a configuração", () => {
  assert.equal(mailerStatus({}).configured, false);
  assert.equal(mailerStatus({ RESEND_API_KEY: "re_x", MAIL_FROM: "A <a@b.c>" }).from, "A <a@b.c>");
});

test("renderEmail escapa conteúdo e inclui o link", () => {
  const { html, text } = renderEmail({ title: "Olá <b>", intro: "x", actionLabel: "Abrir", actionUrl: "https://app.test/#reset=abc" });
  assert.ok(html.includes("Olá &lt;b&gt;"));
  assert.ok(html.includes("https://app.test/#reset=abc"));
  assert.ok(text.includes("Abrir: https://app.test/#reset=abc"));
});

test("sendEmail sem chave não chama a rede", async () => {
  let called = false;
  const result = await sendEmail({ to: "a@b.c", subject: "s", html: "<p/>", text: "t" }, { env: {}, fetchImpl: async () => { called = true; }, logger: { info() {} } });
  assert.equal(result.sent, false); assert.equal(called, false);
});

test("sendEmail chama o Resend com Bearer e trata erro", async () => {
  const calls = [];
  const ok = await sendEmail({ to: "a@b.c", subject: "s", html: "<p/>", text: "t" }, { env: { RESEND_API_KEY: "re_test" }, fetchImpl: async (url, init) => { calls.push([url, init]); return { ok: true, status: 200, json: async () => ({ id: "em_1" }) }; } });
  assert.equal(ok.sent, true); assert.equal(ok.id, "em_1");
  assert.equal(calls[0][1].headers.Authorization, "Bearer re_test");
  const fail = await sendEmail({ to: "a@b.c", subject: "s", html: "<p/>", text: "t" }, { env: { RESEND_API_KEY: "re_test" }, fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({ message: "domain not verified" }) }), logger: { error() {} } });
  assert.equal(fail.sent, false); assert.match(fail.reason, /domain/);
});
