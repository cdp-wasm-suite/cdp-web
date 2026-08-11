// Service worker — offline support for the installed (or just revisited) app.
//
// Strategy: network-first with cache fallback, for same-origin GETs only.
// Online behaviour is byte-identical to having no service worker (every request
// goes to the network, so a deploy is picked up on the next load, exactly as
// today), but every successful response is copied into the cache, and when the
// network is gone the last good copy is served instead. Because each online
// load overwrites the cache with the set of files that were actually served
// together, the cache always holds a coherent snapshot of one release — the
// mixed-version hazard of stale-while-revalidate on an unhashed site like this
// one (native ESM, no bundler, no content-hashed filenames) never arises.
//
// Seeding: a page load only pulls in what it uses, and most of this app is
// loaded on demand — 240-odd per-program .wasm files fetched inside the render
// worker, the Faust compiler, the manual. Waiting for those to be visited
// would leave first-visit offline support hollow, so install() seeds the cache
// from ./sw-precache.json, a list of every runtime file, written next to this
// worker by scripts/build-site.mjs. The dev server has no build step and no
// such file; there the seed is skipped and the worker degrades to plain
// runtime caching, which is fine — dev is online by definition.
//
// VERSION is stamped by build-site.mjs (the tracked source says 'dev'). Its
// only job is to make each release's sw.js differ byte-wise from the last so
// the browser re-runs install() and seeds files added by the release; the
// cache NAME stays the same across releases so an update never throws away
// 20 MB of engine binaries just to refetch them (network-first keeps every
// cached file fresh whenever it is requested online).
const VERSION = 'dev';
const CACHE = 'cdp-web-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(seed().then(() => self.skipWaiting()));
});

async function seed() {
  let list;
  try {
    const res = await fetch('./sw-precache.json', { cache: 'no-cache' });
    if (!res.ok) return;                       // dev server — no manifest, no seed
    list = await res.json();
  } catch { return; }
  const cache = await caches.open(CACHE);
  const have = new Set((await cache.keys()).map((r) => r.url));
  const missing = list.filter((p) => !have.has(new URL(p, self.registration.scope).href));
  // Individually, tolerating failures: one flaky fetch out of ~300 must not
  // abort the install (cache.addAll would). Whatever is missed is picked up by
  // runtime caching, or by the next release's install.
  await Promise.allSettled(missing.map(async (p) => {
    const res = await fetch(p);
    if (res.ok && res.status === 200) await cache.put(p, res);
  }));
}

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) {
      if (k.startsWith('cdp-web-') && k !== CACHE) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                          // GitHub API posts etc. pass through
  if (new URL(req.url).origin !== location.origin) return;   // everything the app needs is same-origin
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      // Cache only complete 200s — a 206 Range slice or an error page stored
      // under the full URL would be served whole to a later request.
      if (res.ok && res.status === 200) {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch (err) {
      // ignoreSearch on navigations: the cached shell is './', but a launch can
      // arrive as './?appName=…' (host override) or a file_handlers targetURL.
      const cached = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
      if (cached) return cached;
      // An uncached deep navigation while offline gets the app shell rather
      // than the browser's offline error page.
      if (req.mode === 'navigate') {
        const shell = await caches.match('./');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
