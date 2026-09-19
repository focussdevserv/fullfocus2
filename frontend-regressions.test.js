import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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

test("módulos e estilos carregados sob demanda existem no build", () => {
  const loader = source("module-loader.js");
  const moduleFiles = [...loader.matchAll(/["']([\w-]+\.js)["']/g)].map((match) => match[1]);
  const styleNames = [...loader.matchAll(/["']([\w-]+\.js)["']:\s*["']([\w-]+)["']/g)].map((match) => match[2]);
  assert.ok(moduleFiles.length > 10);
  for (const file of new Set(moduleFiles)) assert.ok(existsSync(new URL(`modules/${file}`, import.meta.url)), `${file} precisa existir`);
  for (const name of new Set(styleNames)) assert.ok(existsSync(new URL(`modules/${name}.css`, import.meta.url)), `${name}.css precisa existir`);
});

test("frontend envia sessão, mostra estados legíveis e não promove permissão por omissão", () => {
  const app = source("app.js");
  const permissions = source("server/permissions.js");
  assert.match(app, /credentials:\s*"same-origin"/);
  assert.match(app, /stateBlock\.loading/);
  assert.match(app, /stateBlock\.error/);
  assert.match(permissions, /if \(!permissions \|\| typeof permissions !== "object"\) return false/);
  assert.match(permissions, /Rota sem política de acesso explícita/);
});
