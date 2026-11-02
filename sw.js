// Service worker simples: deixa o app abrir rápido e funcionar com sinal fraco.
// Dados do banco nunca são guardados em cache — sempre vêm atualizados.
const CACHE = "firehelp-v1";
const CORE = ["/", "/styles/app.css", "/app/main.js", "/app/sb.js", "/app/ui.js", "/app/store.js", "/app/config.js", "/assets/mimo/rosto.webp"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  // Páginas: rede primeiro, cache se estiver sem conexão.
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("/")));
    return;
  }
  // Imagens e mapa: cache primeiro (mudam raramente).
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/vendor/")) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    })));
    return;
  }
  // Código do app: rede primeiro (sempre a versão nova), cache só sem conexão.
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request)));
});
