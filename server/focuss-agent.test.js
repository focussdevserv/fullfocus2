import test from "node:test";
import assert from "node:assert/strict";
import { callFocussAgent } from "./focuss-agent.js";

test("agente não simula resposta quando a integração de IA não está configurada", async () => {
  await assert.rejects(() => callFocussAgent({ apiKey: "" }), (error) => error.code === "AI_NOT_CONFIGURED");
});

test("agente interpreta resposta estruturada da Responses API", async () => {
  const result = await callFocussAgent({ apiKey: "test-key", messages: [{ direction: "in", body: "Quero um site" }], fetchImpl: async (_url, options) => {
    assert.equal(options.method, "POST");
    assert.match(options.headers.authorization, /^Bearer /);
    return new Response(JSON.stringify({ id: "resp_test", output_text: JSON.stringify({ reply: "Posso te ajudar.", intent: "PEDIDO_ORCAMENTO", next_step: "Perguntar o tipo de negócio", action: "none", action_payload: "{}", confidence: "high" }) }), { status: 200, headers: { "content-type": "application/json" } });
  } });
  assert.equal(result.reply, "Posso te ajudar.");
  assert.equal(result.intent, "PEDIDO_ORCAMENTO");
  assert.equal(result.response_id, "resp_test");
});
