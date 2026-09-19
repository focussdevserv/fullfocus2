import test from "node:test";
import assert from "node:assert/strict";
import { permissionAllows } from "./permissions.js";

test("membro sem cargo pode consultar, mas não gravar por padrão", () => {
  assert.equal(permissionAllows(null, "crm", "clients", "view"), true);
  assert.equal(permissionAllows(undefined, "crm", "clients", "create"), false);
  assert.equal(permissionAllows({}, "crm", "clients", "edit"), false);
  assert.equal(permissionAllows({}, "crm", "clients", "delete"), false);
});

test("permissões específicas continuam funcionando", () => {
  const permissions = { clients: ["view", "edit"], finance: { view: true } };
  assert.equal(permissionAllows(permissions, "crm", "clients", "view"), true);
  assert.equal(permissionAllows(permissions, "crm", "clients", "edit"), true);
  assert.equal(permissionAllows(permissions, "crm", "clients", "delete"), false);
  assert.equal(permissionAllows(permissions, "finance", "receivables", "view"), true);
  assert.equal(permissionAllows(permissions, "finance", "receivables", "create"), false);
});
