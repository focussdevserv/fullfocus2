// Incrementar a versão invalida o shell antigo após cada publicação relevante.
const CACHE = "focusdev-shell-v54";
const APP_SHELL = ["/", "/index.html", "/portal-actions.js?v=1", "/styles.css?v=10", "/design.css?v=3", "/modules/estrutura.css?v=2", "/ui.css?v=9", "/modules/inicio.css?v=9", "/modules/tarefas.css?v=9", "/modules/agenda.css?v=9", "/modules/inbox.css?v=9", "/modules/crm.css?v=10", "/modules/contas.css?v=11", "/modules/operacao.css?v=10", "/modules/financeiro.css?v=11", "/modules/catalogo.css?v=9", "/modules/automacoes.css?v=9", "/modules/configuracoes.css?v=9", "/modules/whatsapp.css?v=9", "/app.js?v=14", "/ui.js?v=10", "/modules/inicio.js?v=11", "/modules/tarefas.js?v=11", "/modules/agenda.js?v=11", "/modules/agenda-enhanced.js?v=10", "/modules/inbox.js?v=11", "/modules/crm.js?v=12", "/modules/contas.js?v=11", "/modules/operacao.js?v=14", "/modules/financeiro.js?v=13", "/modules/cobrancas.js?v=3", "/modules/assinaturas.js?v=12", "/modules/catalogo.js?v=12", "/modules/automacoes.js?v=12", "/modules/templates.js?v=12", "/modules/base-conhecimento.js?v=12", "/modules/formularios.js?v=13", "/modules/integracoes.js?v=13", "/modules/tickets.js?v=13", "/modules/arquivos.js?v=12", "/modules/automacoes-workspace.js?v=12", "/modules/lixeira.js?v=12", "/modules/configuracoes.js?v=10", "/modules/whatsapp.js?v=10", "/modules/estrutura.js?v=13", "/modules/briefings.js?v=12", "/modules/contas-pagar.js?v=11", "/modules/notas-fiscais.js?v=12", "/modules/contas-bancarias.js?v=12", "/modules/relatorios-financeiros.js?v=12", "/modules/team-access.js?v=12", "/modules/auditoria.js?v=13", "/modules/infraestrutura.js?v=11", "/modules/gestao.js?v=13", "/modules/configuracoes-enhanced.js?v=11", "/manifest.webmanifest", "/assets/icon-192.svg", "/assets/icon-512.svg"];
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
