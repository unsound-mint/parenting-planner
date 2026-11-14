// The service worker, served from the root so its scope covers /help. It does
// one job: keep the fixed help screen working without a network.
// - /help navigations: network first, the cached copy only when the network fails.
// - /_next/static files: from the cache when the help screen cached them (the
//   ones its HTML lists, and any a /help page loaded later); otherwise the network.
// - Nothing else is intercepted: API calls, other pages and their data never touch it.
// A route handler instead of public/sw.js because the Docker image copies only
// the standalone output and .next/static.
const script = `
const CACHE = "pp-help-v2";
const HELP = "/help";

async function keep(res) {
  const cache = await caches.open(CACHE);
  const html = await res.clone().text();
  const assets = [...new Set([...html.matchAll(/\\/_next\\/static\\/[^"'\\s)\\\\]+/g)].map((m) => m[0]))];
  await cache.put(HELP, res);
  await Promise.all(assets.map((a) => cache.add(a).catch(() => {})));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    fetch(HELP, { cache: "no-store" })
      .then((res) => (res.ok ? keep(res) : undefined))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("pp-help-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate" && url.pathname === HELP) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) event.waitUntil(keep(res.clone()).catch(() => {}));
          return res;
        })
        .catch(() => caches.match(HELP, { ignoreSearch: true }).then((hit) => hit || Response.error())),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then(async (hit) => {
        if (hit) return hit;
        const res = await fetch(req);
        // Chunks the help screen loads after the HTML (client islands) are not
        // listed in it, so keep whatever a /help page asks for.
        if (res.ok && event.clientId) {
          const copy = res.clone();
          event.waitUntil(
            self.clients.get(event.clientId).then((client) => {
              if (client && new URL(client.url).pathname === HELP) {
                return caches.open(CACHE).then((cache) => cache.put(req, copy));
              }
            }),
          );
        }
        return res;
      }),
    );
  }
});
`;

export function GET() {
  return new Response(script, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
