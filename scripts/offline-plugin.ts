import type { Plugin } from 'vite'

// Precache every emitted chunk, including routes that have never been opened.
export function offlinePlugin(buildId: string): Plugin {
  return {
    name: 'offline-shell',
    generateBundle(_, bundle) {
      const files = [
        'index.html',
        ...Object.keys(bundle).filter((name) => name !== 'version.json'),
      ]
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `
const CACHE = ${JSON.stringify(`daylog-shell-${buildId}`)};
const FILES = ${JSON.stringify(files)};
const ROOT = new URL('./', self.location.href);
self.addEventListener('install', event => {
 event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(path => new URL(path, ROOT).href))));
});
// Keep the old worker active until its open editors close. Updates never force a reload.
self.addEventListener('activate', event => {
 event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', event => {
 const url = new URL(event.request.url);
 if (event.request.method !== 'GET' || url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
 if (event.request.mode === 'navigate') {
  // Auth callback query strings remain in the address bar, but never enter the cache.
  event.respondWith((async () => {
   const controller = new AbortController();
   const timeout = setTimeout(() => controller.abort(), 3000);
   try {
    const response = await fetch(event.request, { signal: controller.signal });
    if (response.ok) return response;
   } catch {} finally { clearTimeout(timeout); }
   const cache = await caches.open(CACHE);
   return await cache.match(new URL('index.html', ROOT).href) || Response.error();
  })());
  return;
 }
 const path = url.pathname.slice(ROOT.pathname.length);
 if (!FILES.includes(path)) return;
 event.respondWith(caches.open(CACHE).then(cache => cache.match(new URL(path, ROOT).href))
  .then(cached => cached || fetch(event.request)));
});
`,
      })
    },
  }
}
