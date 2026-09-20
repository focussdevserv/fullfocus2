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

test("visão 360 mantém abas, métricas e endpoint dedicado", () => {
  const contas = source("modules/contas.js");
  for (const tab of ["sheet-overview", "sheet-profile", "sheet-commercial", "sheet-projects", "sheet-finance", "sheet-history"]) assert.match(contas, new RegExp(`data-client-tab="${tab}"`));
  assert.match(contas, /\/api\/clients\/\$\{record\.id\}\/overview/);
  assert.match(contas, /data\.summary\.open_tickets/);
  assert.match(contas, /data\.summary\.pending_changes/);
});

test("resposta da Visão 360 deduplica vínculos por id", () => {
  const contas = source("server/routes/contas.js");
  assert.match(contas, /const uniqueRows = \(items\) =>/);
  assert.match(contas, /if \(seen\.has\(key\)\) return false/);
  assert.match(contas, /const overviewRows = \{ contacts: uniqueRows\(contacts\.rows\)/);
});

test("ficha trata estado vazio e erro sem apagar o drawer", () => {
  const contas = source("modules/contas.js");
  assert.match(contas, /const rows = \(items, render, message, options = \{\}\) =>/);
  assert.match(contas, /contaState\("error", error\.message\)/);
  assert.match(contas, /if \(overview\.isConnected\) overview\.insertAdjacentHTML\("beforeend", contaState\("error", error\.message\)\)/);
});

test("criação de cliente reabre a ficha pelo id canônico e respeita a rota", () => {
  const app = source("app.js");
  const contas = source("modules/contas.js");
  assert.match(app, /renderHashRoute\(window\.location\.hash\); if \(method === "POST" && typeof config\.onCreated === "function"\) await config\.onCreated\(data, payload\)/);
  assert.match(contas, /if \(location\.hash === "#clientes" && data\?\.client\?\.id\) window\.FocusOpenClientDetails\?\.\(\{ \.\.\.payload, \.\.\.data\.client \}\)/);
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

test("central de configurações serializa saves e mescla cada seção no estado mais recente", () => {
  const hub = source("modules/configuracoes-hub.js");
  assert.match(hub, /let settingsSaveQueue = Promise\.resolve\(\)/);
  assert.match(hub, /settingsSaveQueue\.catch\(\(\) => \{\}\)\.then\(async \(\) => \{/);
  assert.match(hub, /const nextSettings = \{ \.\.\.settings, \.\.\.sectionSettings \}/);
  assert.match(hub, /await api\("\/api\/organization", \{ method: "PATCH", body \}\)/);
  assert.match(hub, /Object\.assign\(settings, nextSettings\)/);
  assert.match(hub, /delete sectionSettings\.name/);
  assert.match(hub, /if \(form\.dataset\.hubSaving === "true"\) return/);
  assert.match(hub, /form\.setAttribute\("aria-busy", "true"\)/);
  assert.match(hub, /const errorMessage = error\?\.message \|\| "Não foi possível salvar as alterações\."/);
  assert.doesNotMatch(hub, /const next = \{ \.\.\.settings, \.\.\.values \}/);
});

test("loader limpa o timeout perdedor da corrida de importação", () => {
  const loader = source("module-loader.js");
  assert.match(loader, /let timeoutId/);
  assert.match(loader, /Promise\.race\(\[importPromise, timeout\]\)\.finally\(\(\) => window\.clearTimeout\(timeoutId\)\)/);
});

test("polling do frontend evita sobreposição e cancela chamadas demoradas", () => {
  const app = source("app.js");
  assert.match(app, /if \(browserNotificationsController \|\| appShell\.hidden\) return/);
  assert.match(app, /window\.setTimeout\(\(\) => controller\.abort\(\), 15000\)/);
  assert.match(app, /window\.addEventListener\("pagehide", \(\) => browserNotificationsController\?\.abort\(\)\)/);
  assert.match(app, /refreshInboxBadge\.pending/);
  assert.match(app, /notificationPanelPollPending/);
});

test("listeners globais não são duplicados e busca da inbox só redesenha após debounce", () => {
  const app = source("app.js");
  const inbox = source("modules/inbox.js");
  assert.equal((app.match(/querySelectorAll\("\[data-home-task\]"\).*addEventListener/g) || []).length, 0);
  assert.equal((app.match(/querySelector\("\.dialog-close"\).*addEventListener/g) || []).length, 1);
  assert.equal((app.match(/createDialog\.addEventListener\("keydown"/g) || []).length, 1);
  assert.doesNotMatch(app, /dataset\.readBusy/);
  const searchHandler = inbox.match(/search\?\.addEventListener\("input", \(\) => \{([\s\S]*?)\n  \}\);/)?.[1] || "";
  assert.doesNotMatch(searchHandler.slice(0, searchHandler.indexOf("setTimeout")), /draw\(\)/);
  assert.equal((searchHandler.match(/draw\(\)/g) || []).length, 1);
  assert.match(searchHandler, /box\.loadRequest \+= 1/);
  assert.match(searchHandler, /clearTimeout\(box\.searchTimer\)/);
  assert.match(searchHandler, /box\.searchController\?\.abort\(\)/);
  assert.match(searchHandler, /load\(\{ signal: controller\.signal \}\)/);
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

test("ficha do cliente mantém o vínculo e salva itens e recálculo da proposta fora da rota exclusiva", () => {
  const crm = source("modules/crm.js");
  const contas = source("modules/contas.js");
  const drawerFlow = crm.slice(crm.indexOf("async function proposalDrawer"), crm.indexOf("function printProposal"));
  assert.match(contas, /FocusOpenProposalForClient\(clientId, tools\.dataset\.clientName\)/);
  assert.match(contas, /FocusEditProposal\?\.\(item, record\.id, record\.name\)/);
  assert.match(crm, /if \(boundClientId\) values\.client_id = boundClientId/);
  assert.match(crm, /proposalDrawer\(proposal\.id, after, fromClientSheet\)/);
  assert.match(drawerFlow, /api\(`\/api\/proposals\/\$\{p\.id\}\/items`, \{ method: "PUT"/);
  assert.match(drawerFlow, /api\(`\/api\/proposals\/\$\{p\.id\}\/recalculate`, \{ method: "POST"/);
  assert.doesNotMatch(drawerFlow, /routeAtStart !== "#propostas"/);
  assert.match(drawerFlow, /save\.textContent = "Salvando…"/);
  assert.match(drawerFlow, /feedback\("Itens e valores salvos\.", "success"\)/);
  assert.match(drawerFlow, /feedback\(error\.message, "error"\)/);
  assert.match(drawerFlow, /save\.disabled = false/);
  assert.match(drawerFlow, /button\.disabled = false/);
});

test("ficha do cliente cria e lista oportunidades reais vinculadas", () => {
  const crm = source("modules/crm.js");
  const contas = source("modules/contas.js");
  assert.match(contas, /data-client-create="oportunidade"/);
  assert.match(contas, /oportunidade: "oportunidades"/);
  assert.match(contas, /FocusOpenOpportunityForClient\(clientId, tools\.dataset\.clientName/);
  assert.match(contas, /data\.summary\?\.opportunities_total/);
  assert.match(contas, /rows\(data\.opportunities/);
  assert.match(contas, /Nenhuma oportunidade vinculada\./);
  assert.match(crm, /window\.FocusOpenOpportunityForClient/);
  assert.match(crm, /if \(boundClientId\) values\.client_id = boundClientId/);
  assert.match(crm, /Oportunidade criada e vinculada ao cliente\./);
});

test("ficha do cliente usa cadastro unificado, vínculos opcionais e ações relacionadas", () => {
  const contas = source("modules/contas.js");
  assert.match(contas, /endpoint: "\/api\/clients\/quick"/);
  assert.match(contas, /field\("company_id", "Empresa", "select", \{ options: \[\] \}\)/);
  assert.match(contas, /field\("company_name", "Empresa \(opcional\)"\)/);
  assert.match(contas, /field\("contact_id", "Contato", "select", \{ options: \[\] \}\)/);
  assert.match(contas, /window\.prepareCreate = async function prepareClientCreate/);
  assert.match(contas, /await prepareCreate\(kind, shouldOpen && location\.hash !== "#portal-do-cliente"\)/);
  for (const action of ["oportunidade", "projeto", "proposta", "contrato", "recebivel", "assinatura", "tarefa", "ticket"]) {
    assert.match(contas, new RegExp(`data-client-create="${action}"`));
  }
  assert.match(contas, /clientField\.options = \[\["", "Sem cliente"\]/);
});

test("ficha mantém uma única configuração de cliente e bloqueia duplo envio das ações", () => {
  const contas = source("modules/contas.js");
  assert.equal((contas.match(/createConfig\.cliente\s*=/g) || []).length, 1);
  assert.match(contas, /field\("status", "Status", "select"/);
  assert.doesNotMatch(contas, /createConfig\.cliente\.fields\[5\]\.options/);
  assert.match(contas, /button\.disabled = true; button\.textContent = "Abrindo/);
  assert.match(contas, /if \(!kind \|\| !clientId \|\| button\.disabled\) return/);
  assert.match(contas, /finally \{ button\.disabled = false; button\.textContent = original; \}/);
});
test("ficha 360 evita requisicoes operacionais imediatas", () => {
  const contas = source("modules/contas.js");
  assert.doesNotMatch(contas, /hydrateClientOperationSections\(overview, record, data, \{ money, label, rows \}\)\.catch\(\(\) => \{\}\);/);
  assert.match(contas, /selected === "sheet-projects" && overview\.dataset\.operationSectionsLoaded !== "1"/);
  assert.match(contas, /overview\.dataset\.operationSectionsLoaded = "1"; hydrateClientOperationSections\(overview, record, data, \{ money, label, rows \}\)/);
  assert.match(contas, /overview\.dataset\.operationSectionsLoaded = "0"/);
  assert.match(contas, /api\/clients\/\$\{record\.id\}\/overview\/section\/\$\{key\}/);
  for (const section of ["tasks", "files", "briefings", "change_requests", "infrastructure"]) assert.match(contas, new RegExp(`\\["${section}"`));
});

test("ficha 360 oferece abas acessíveis, retry e indicação de listas limitadas", () => {
  const contas = source("modules/contas.js");
  const css = source("modules/contas.css");
  assert.match(contas, /setAttribute\("role", "tablist"\)/);
  assert.match(contas, /setAttribute\("role", "tab"\)/);
  assert.match(contas, /aria-controls/);
  assert.match(contas, /setAttribute\("role", "tabpanel"\)/);
  assert.match(contas, /ArrowRight.*ArrowDown.*ArrowLeft.*ArrowUp/);
  assert.match(contas, /data-client-section-retry/);
  assert.match(contas, /Tentar novamente/);
  assert.match(contas, /data-client-list-limit/);
  assert.match(contas, /Ver todos/);
  assert.match(css, /client-list-limit/);
  assert.match(css, /aria-selected="true"/);
});

test("ficha 360 isola respostas obsoletas e mantém layout móvel", () => {
  const contas = source("modules/contas.js");
  const css = source("modules/contas.css");
  assert.match(contas, /const sheetRequest = \+\+contaClientSheetEpoch/);
  assert.match(contas, /sheetRequest !== contaClientSheetEpoch/);
  assert.match(contas, /panel\.dataset\.clientId !== String\(record\.id\)/);
  assert.match(contas, /document\.querySelectorAll\("\.conta-drawer-wide"\)/);
  assert.match(css, /@media\(max-width:420px\)/);
  assert.match(css, /min-height:44px/);
  assert.match(css, /overflow-wrap:anywhere|word-break/);
});

test("agente comunica prontidão, ativa com segurança e mantém histórico legível", () => {
  const agente = source("modules/agente.js");
  const css = source("modules/agente.css");
  assert.match(agente, /Configurar integração/);
  assert.match(agente, /window\.confirm\("Ativar o Agente Focussdev/);
  assert.match(agente, /Configure a IA antes de ativar o agente/);
  assert.match(agente, /data-agent-capabilities-retry/);
  assert.match(agente, /Histórico da sessão/);
  assert.match(agente, /aria-live="polite"/);
  assert.match(agente, /Salvando configuração…/);
  assert.match(agente, /Consultando o agente…/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /overscroll-behavior:contain/);
  assert.match(css, /overflow-wrap:anywhere/);
});
