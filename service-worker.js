// Incrementar a versão invalida o shell antigo após cada publicação relevante.
const CACHE = "focusdev-shell-v72";
// As versões do núcleo vêm do index; módulos e estilos sob demanda usam o
// mesmo ?v=4 empregado pelo module-loader.
const APP_SHELL = [
  "/", "/index.html", "/module-loader.js?v=4", "/portal-actions.js?v=2",
  "/styles.css?v=18", "/ui.css?v=9", "/design.css?v=4", "/app.js?v=21", "/ui.js?v=11",
  "/modules/inicio.css?v=4", "/modules/tarefas.css?v=4", "/modules/agenda.css?v=4", "/modules/inbox.css?v=4",
  "/modules/crm.css?v=4", "/modules/contas.css?v=4", "/modules/operacao.css?v=4", "/modules/financeiro.css?v=4",
  "/modules/catalogo.css?v=4", "/modules/automacoes.css?v=4", "/modules/configuracoes.css?v=4",
  "/modules/whatsapp.css?v=4", "/modules/estrutura.css?v=4",
  "/modules/inicio.js?v=4", "/modules/tarefas.js?v=4", "/modules/agenda.js?v=4", "/modules/agenda-enhanced.js?v=4",
  "/modules/inbox.js?v=4", "/modules/crm.js?v=4", "/modules/contas.js?v=4", "/modules/operacao.js?v=4",
  "/modules/financeiro.js?v=4", "/modules/cobrancas.js?v=4", "/modules/assinaturas.js?v=4", "/modules/catalogo.js?v=4",
  "/modules/automacoes.js?v=4", "/modules/templates.js?v=4", "/modules/base-conhecimento.js?v=4",
  "/modules/formularios.js?v=4", "/modules/integracoes.js?v=4", "/modules/integracoes-enhanced.js?v=4",
  "/modules/tickets.js?v=4", "/modules/arquivos.js?v=4", "/modules/automacoes-workspace.js?v=4", "/modules/lixeira.js?v=4",
  "/modules/configuracoes-hub.js?v=4", "/modules/whatsapp.js?v=4", "/modules/agente.js?v=4", "/modules/estrutura.js?v=4",
  "/modules/briefings.js?v=4", "/modules/contas-pagar.js?v=4", "/modules/notas-fiscais.js?v=4",
  "/modules/contas-bancarias.js?v=4", "/modules/relatorios-financeiros.js?v=4", "/modules/team-access.js?v=4",
  "/modules/auditoria.js?v=4", "/modules/infraestrutura.js?v=4", "/modules/gestao.js?v=4",
  "/manifest.webmanifest", "/assets/icon-192.svg", "/assets/icon-512.svg"
];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.url.includes("/api/")) return;
  event.respondWith(fetch(request).then((response) => {
    // Só guarda respostas válidas: uma falha transitória nunca vira cache.
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(request, copy)); }
    return response;
  }).catch(async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Offline sem cache: só navegações recebem o shell; scripts/estilos falham de forma honesta.
    if (request.mode === "navigate") return caches.match("/index.html");
    return Response.error();
  }));
});
