/* Service worker do EcoCharge AI.
   - Páginas: rede primeiro, cópia em cache como reserva (abre mesmo com sinal fraco).
   - Arquivos estáticos do Next (/_next/static, com hash no nome): cache primeiro. */
const CACHE = "ecocharge-v1";
const SHELL = ["/navegador"]; // o app instalado é o navegador

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const put = (req, res) => {
  if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
  return res;
};

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then((res) => put(req, res))
        .catch(() => caches.match(req).then((m) => m || caches.match("/navegador")))
    );
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/pwa-icon/") || /\.(svg|png|woff2)$/.test(url.pathname)) {
    e.respondWith(caches.match(req).then((m) => m || fetch(req).then((res) => put(req, res))));
  }
});
