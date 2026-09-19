import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (file) => readFileSync(new URL(file, import.meta.url), "utf8");

test("estados assíncronos são anunciados e o erro oferece nova tentativa acessível", () => {
  const app = source("app.js");
  assert.match(app, /state-loading" role="status" aria-live="polite" aria-busy="true"/);
  assert.match(app, /state-empty" role="status"/);
  assert.match(app, /aria-label="Tentar carregar esta área novamente"/);
});

test("formulário compartilhado mostra erro no campo, foca o inválido e bloqueia duplo envio", () => {
  const ui = source("ui.js");
  assert.match(ui, /data-field-error=/);
  assert.match(ui, /toggleAttribute\("aria-invalid", Boolean\(message\)\)/);
  assert.match(ui, /if \(submitting\) return/);
  assert.match(ui, /formEl\.elements\[missing\.name\]\?\.focus\(\)/);
  assert.match(ui, /submit\.setAttribute\("aria-busy", "true"\)/);
});

test("feedback crítico e confirmação inline preservam anúncio e foco", () => {
  const ui = source("ui.js");
  assert.match(ui, /tone === "error" \? "alert" : "status"/);
  assert.match(ui, /holder\.querySelector\("\[data-yes\]"\)\?\.focus\(\)/);
  assert.match(ui, /if \(shouldRestoreFocus && !original\.hidden\) original\.focus\(\)/);
  assert.match(ui, /if \(dangerPending\) return/);
});

test("acesso do portal valida confirmação, anuncia resultado e evita envio duplicado", () => {
  const contas = source("modules/contas.js");
  assert.match(contas, /aria-describedby="portal-password-error"/);
  assert.match(contas, /if \(form\.dataset\.busy === "1"\) return/);
  assert.match(contas, /confirmation\.setAttribute\("aria-invalid", "true"\)/);
  assert.match(contas, /confirmation\.focus\(\)/);
  assert.match(contas, /submit\.setAttribute\("aria-busy", "true"\)/);
});
