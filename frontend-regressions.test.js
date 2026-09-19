import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (file) => readFileSync(new URL(file, import.meta.url), "utf8");

test("cadastro rápido abre a ficha pelo cliente retornado", () => {
  const app = source("app.js");
  const contas = source("modules/contas.js");
  assert.match(app, /typeof config\.onCreated === "function"/);
  assert.doesNotMatch(app, /A busca posterior evita duplicar/);
  assert.match(contas, /data\?\.client\?\.id/);
  assert.match(contas, /FocusOpenClientDetails\?\.\(\{ \.\.\.payload, \.\.\.data\.client \}\)/);
});

test("tarefas carrega clientes e preserva as opções de projetos", () => {
  const tarefas = source("modules/tarefas.js");
  assert.match(tarefas, /api\("\/api\/clients"\)/);
  assert.match(tarefas, /projectField\.options = \[\["", "Sem projeto"\]/);
  assert.match(tarefas, /clientField\.options = \[\["", "Sem cliente"\]/);
});

test("service worker usa a mesma versão dos assets declarados no index", () => {
  const html = source("index.html");
  const worker = source("service-worker.js");
  const coreAssets = [...html.matchAll(/(?:src|href)="((?:styles\.css|ui\.css|design\.css|app\.js|ui\.js|module-loader\.js)\?v=\d+)"/g)].map((match) => `/${match[1]}`);
  assert.ok(coreAssets.length > 0);
  for (const asset of coreAssets) assert.ok(worker.includes(`"${asset}"`), `${asset} precisa estar no APP_SHELL`);
  assert.doesNotMatch(worker, /then\(\(cache\) => cache\.addAll\(APP_SHELL\)\)\.then\(\(cache\)/);
});
