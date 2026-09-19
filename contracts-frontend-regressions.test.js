import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const operacao = fs.readFileSync(new URL("./modules/operacao.js", import.meta.url), "utf8");

test("contratos envia busca, status, limite e deslocamento para a API", () => {
  assert.match(operacao, /if \(search\.trim\(\)\) params\.set\("search", search\.trim\(\)\)/);
  assert.match(operacao, /if \(status\) params\.set\("status", status\)/);
  assert.match(operacao, /params\.set\("limit", String\(limit\)\)/);
  assert.match(operacao, /params\.set\("offset", String\(offset\)\)/);
  assert.match(operacao, /api\(`\/api\/contracts\?\$\{params\}`\)/);
});

test("contratos reinicia e muda a pagina de forma deterministica", () => {
  assert.match(operacao, /contractsState\.search = event\.target\.value; contractsState\.offset = 0/);
  assert.match(operacao, /contractsState\.status = event\.target\.value; contractsState\.offset = 0/);
  assert.match(operacao, /contractsState\.offset = Math\.max\(0, contractsState\.offset - contractsState\.limit\)/);
  assert.match(operacao, /contractsState\.offset \+= contractsState\.limit/);
  assert.match(operacao, /data-contracts-next \$\{returned < contractsState\.limit \? "disabled" : ""\}/);
});

test("exportacao de contratos percorre todas as paginas do filtro ou falha sem arquivo", () => {
  assert.match(operacao, /const limit = 250, records = \[\]/);
  assert.match(operacao, /for \(let offset = 0; ; offset \+= limit\)/);
  assert.match(operacao, /fetchAllOperationRecords\("\/api\/contracts", "contracts", \{ search: contractsState\.search, status: contractsState\.status \}\)/);
  assert.match(operacao, /if \(returned < limit \|\| page\.length === 0\) return records/);
  assert.match(operacao, /Exportação cancelada:[\s\S]*Nenhum arquivo foi gerado/);
  assert.doesNotMatch(operacao, /querySelectorAll\("\.operations-table tbody tr"\)/);
});

test("formularios carregam todas as paginas de clientes e contratos", () => {
  assert.match(operacao, /fetchAllOperationRecords\("\/api\/clients", "clients"\)/);
  assert.match(operacao, /kind === "projeto" \? fetchAllOperationRecords\("\/api\/contracts", "contracts"\)/);
  assert.match(operacao, /f\.options = \[\["", "Sem contrato"\], \.\.\.contractRows\.map/);
});
