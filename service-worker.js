const CACHE = "focusdev-shell-v9";
const APP_SHELL = ["/", "/index.html", "/styles.css?v=7", "/modules/inicio.css?v=7", "/modules/tarefas.css?v=7", "/modules/agenda.css?v=7", "/modules/inbox.css?v=7", "/modules/crm.css?v=7", "/modules/contas.css?v=7", "/modules/operacao.css?v=7", "/modules/financeiro.css?v=7", "/modules/catalogo.css?v=7", "/modules/automacoes.css?v=7", "/modules/configuracoes.css?v=7", "/modules/whatsapp.css?v=7", "/app.js?v=7", "/modules/inicio.js?v=7", "/modules/tarefas.js?v=7", "/modules/agenda.js?v=7", "/modules/inbox.js?v=7", "/modules/crm.js?v=7", "/modules/contas.js?v=7", "/modules/operacao.js?v=7", "/modules/financeiro.js?v=7", "/modules/catalogo.js?v=7", "/modules/automacoes.js?v=7", "/modules/configuracoes.js?v=7", "/modules/whatsapp.js?v=7", "/manifest.webmanifest", "/assets/icon-192.svg", "/assets/icon-512.svg"];
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
