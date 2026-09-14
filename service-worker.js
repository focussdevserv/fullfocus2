const CACHE = "focusdev-shell-v22";
const APP_SHELL = ["/", "/index.html", "/portal-actions.js?v=1", "/styles.css?v=9", "/ui.css?v=9", "/modules/inicio.css?v=9", "/modules/tarefas.css?v=9", "/modules/agenda.css?v=9", "/modules/inbox.css?v=9", "/modules/crm.css?v=9", "/modules/contas.css?v=9", "/modules/operacao.css?v=9", "/modules/financeiro.css?v=9", "/modules/catalogo.css?v=9", "/modules/automacoes.css?v=9", "/modules/configuracoes.css?v=9", "/modules/whatsapp.css?v=9", "/app.js?v=10", "/ui.js?v=10", "/modules/inicio.js?v=10", "/modules/tarefas.js?v=10", "/modules/agenda.js?v=10", "/modules/agenda-enhanced.js?v=10", "/modules/inbox.js?v=10", "/modules/crm.js?v=12", "/modules/contas.js?v=10", "/modules/operacao.js?v=11", "/modules/financeiro.js?v=11", "/modules/catalogo.js?v=10", "/modules/automacoes.js?v=10", "/modules/configuracoes.js?v=10", "/modules/whatsapp.js?v=10", "/modules/estrutura.js?v=10", "/modules/briefings.js?v=10", "/modules/base-conhecimento.js?v=10", "/modules/formularios.js?v=10", "/modules/integracoes.js?v=10", "/modules/tickets.js?v=10", "/modules/arquivos.js?v=10", "/modules/automacoes-workspace.js?v=10", "/modules/lixeira.js?v=10", "/modules/cobrancas.js?v=10", "/modules/assinaturas.js?v=10", "/modules/contas-bancarias.js?v=10", "/modules/relatorios-financeiros.js?v=10", "/modules/team-access.js?v=10", "/modules/auditoria.js?v=10", "/modules/infraestrutura.js?v=10", "/modules/gestao.js?v=10", "/modules/configuracoes-enhanced.js?v=10", "/manifest.webmanifest", "/assets/icon-192.svg", "/assets/icon-512.svg"];
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
