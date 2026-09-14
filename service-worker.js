const CACHE = "focusdev-shell-v8";
const APP_SHELL = ["/", "/index.html", "/styles.css?v=7", "/modules/meu-dia.css?v=7", "/modules/inbox.css?v=7", "/modules/crm.css?v=7", "/modules/contas.css?v=7", "/modules/operacao.css?v=7", "/modules/financeiro.css?v=7", "/modules/catalogo.css?v=7", "/modules/automacoes.css?v=7", "/modules/configuracoes.css?v=7", "/app.js?v=7", "/modules/meu-dia.js?v=7", "/modules/inbox.js?v=7", "/modules/crm.js?v=7", "/modules/contas.js?v=7", "/modules/operacao.js?v=7", "/modules/financeiro.js?v=7", "/modules/catalogo.js?v=7", "/modules/automacoes.js?v=7", "/modules/configuracoes.js?v=7", "/manifest.webmanifest", "/assets/icon-192.svg", "/assets/icon-512.svg"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.url.includes("/api/")) return;
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match("/index.html"))));
});
