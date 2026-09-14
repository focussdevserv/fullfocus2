import test from "node:test";
import assert from "node:assert/strict";
import { isPrivateIp, parseOutboundUrl, assertSafeOutboundUrl } from "./outbound-url.js";

test("isPrivateIp reconhece loopback, redes privadas, link-local e IPv6 interno", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "fc00::1", "::ffff:127.0.0.1"]) assert.equal(isPrivateIp(ip), true, ip);
  for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700::1111"]) assert.equal(isPrivateIp(ip), false, ip);
});

test("parseOutboundUrl rejeita esquemas, credenciais e hosts internos", () => {
  assert.equal(parseOutboundUrl("ftp://example.com").ok, false);
  assert.equal(parseOutboundUrl("http://user:pass@example.com").ok, false);
  assert.equal(parseOutboundUrl("http://localhost:3000/hook").ok, false);
  assert.equal(parseOutboundUrl("http://127.0.0.1/hook").ok, false);
  assert.equal(parseOutboundUrl("http://169.254.169.254/latest/meta-data").ok, false);
  assert.equal(parseOutboundUrl("http://api.internal/x").ok, false);
  assert.equal(parseOutboundUrl("not a url").ok, false);
  assert.equal(parseOutboundUrl("https://hooks.example.com/abc").ok, true);
});

test("assertSafeOutboundUrl resolve DNS e bloqueia hosts que apontam para IP privado", async () => {
  await assert.rejects(assertSafeOutboundUrl("https://evil.example", { lookup: async () => [{ address: "10.0.0.5" }] }), /internos/);
  await assert.rejects(assertSafeOutboundUrl("https://nao-resolve.example", { lookup: async () => { throw new Error("ENOTFOUND"); } }), /resolver/);
  const url = await assertSafeOutboundUrl("https://hooks.example.com/abc", { lookup: async () => [{ address: "93.184.216.34" }] });
  assert.equal(url.hostname, "hooks.example.com");
});
