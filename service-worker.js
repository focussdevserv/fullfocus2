// Incrementar a versão invalida o shell antigo após cada publicação relevante.
const CACHE = "focusdev-shell-v64";
const APP_SHELL = ["/", "/index.html", "/portal-actions.js?v=2", "/styles.css?v=11", "/design.css?v=4", "/modules/estrutura.css?v=3", "/ui.css?v=9", "/modules/inicio.css?v=10", "/modules/tarefas.css?v=10", "/modules/agenda.css?v=10", "/modules/inbox.css?v=10", "/modules/crm.css?v=11", "/modules/contas.css?v=12", "/modules/operacao.css?v=11", "/modules/financeiro.css?v=12", "/modules/catalogo.css?v=10", "/modules/automacoes.css?v=10", "/modules/configuracoes.css?v=10", "/modules/whatsapp.css?v=10", "/app.js?v=18", "/ui.js?v=11", "/modules/inicio.js?v=12", "/modules/tarefas.js?v=13", "/modules/agenda.js?v=13", "/modules/agenda-enhanced.js?v=11", "/modules/inbox.js?v=12", "/modules/crm.js?v=14", "/modules/contas.js?v=13", "/modules/operacao.js?v=16", "/modules/financeiro.js?v=15", "/modules/cobrancas.js?v=5", "/modules/assinaturas.js?v=16", "/modules/catalogo.js?v=13", "/modules/automacoes.js?v=13", "/modules/templates.js?v=14", "/modules/base-conhecimento.js?v=15", "/modules/formularios.js?v=14", "/modules/integracoes.js?v=15", "/modules/tickets.js?v=16", "/modules/arquivos.js?v=16", "/modules/automacoes-workspace.js?v=15", "/modules/lixeira.js?v=13", "/modules/configuracoes.js?v=12", "/modules/whatsapp.js?v=11", "/modules/estrutura.js?v=16", "/modules/briefings.js?v=14", "/modules/contas-pagar.js?v=14", "/modules/notas-fiscais.js?v=13", "/modules/contas-bancarias.js?v=15", "/modules/relatorios-financeiros.js?v=13", "/modules/team-access.js?v=14", "/modules/auditoria.js?v=15", "/modules/infraestrutura.js?v=13", "/modules/gestao.js?v=15", "/modules/configuracoes-enhanced.js?v=12", "/manifest.webmanifest", "/assets/icon-192.svg", "/assets/icon-512.svg"];
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
