import test from "node:test";
import assert from "node:assert/strict";
import { singular, SINGULAR, classifyDbError, isValidAmount, TABLES_WITH_UPDATED_AT, normalizeIdentity } from "./http-helpers.js";

test("normaliza identidades antes da deduplicação", () => {
  assert.equal(normalizeIdentity("email", "  Pessoa@EXEMPLO.COM "), "pessoa@exemplo.com");
  assert.equal(normalizeIdentity("phone", "+55 (11) 99999-0000"), "5511999990000");
  assert.equal(normalizeIdentity("document", "11.222.333/0001-81"), "11222333000181");
});

test("singular cobre todas as tabelas com plural irregular", () => {
  assert.equal(singular("companies"), "company");
  assert.equal(singular("opportunities"), "opportunity");
  for (const table of Object.keys(SINGULAR)) assert.equal(typeof singular(table), "string");
  assert.throws(() => singular("desconhecida"));
});

test("classifyDbError transforma violações de entrada em 400 e o resto em 503", () => {
  assert.deepEqual(classifyDbError({ code: "23514" }).status, 400);
  assert.deepEqual(classifyDbError({ code: "23502" }).status, 400);
  assert.deepEqual(classifyDbError({ code: "22P02" }).status, 400);
  assert.deepEqual(classifyDbError({ code: "22003" }).status, 400);
  assert.deepEqual(classifyDbError({ code: "23503" }).status, 400);
  assert.deepEqual(classifyDbError({ code: "23505" }).status, 409);
  assert.deepEqual(classifyDbError(new Error("boom"), "Falhou."), { status: 503, error: "Falhou." });
});

test("isValidAmount permite zero apenas onde o schema permite", () => {
  assert.equal(isValidAmount("revenues", "amount", 0), false);
  assert.equal(isValidAmount("revenues", "amount", 10.5), true);
  assert.equal(isValidAmount("opportunities", "amount", 0), true);
  assert.equal(isValidAmount("contracts", "value", 0), true);
  assert.equal(isValidAmount("contracts", "value", -1), false);
  assert.equal(isValidAmount("expenses", "amount", "abc"), false);
});

test("lista de tabelas com updated_at é explícita", () => {
  assert.ok(TABLES_WITH_UPDATED_AT.has("leads"));
  assert.ok(!TABLES_WITH_UPDATED_AT.has("revenues"));
});
