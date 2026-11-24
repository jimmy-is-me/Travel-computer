"use strict";
const BASE = new URL('./', self.location.href);
const PREFIX = 'travel-computer-shell-' + BASE.pathname + ':';
const CACHE = PREFIX + 'v3-1';
const HOME = BASE.href;
const ASSETS = ['styles.css', 'responsive.css', 'split.css', 'app.js?v=3', 'ui.js', 'split-model.js', 'split-ui.js', 'manifest.webmanifest', 'icon.svg'].map(path => new URL(path, BASE).href);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([HOME, ...ASSETS].map(url => new Request(url, {cache: 'reload', redirect: 'error'})))));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.allSettled(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function fallback(url) {
  try {
    const response = await (await caches.open(CACHE)).match(url);
    return response && response.ok && !response.redirected ? response : null;
  } catch {
    return null;
  }
}

async function serve(request, url, isHome) {
  try {
    const response = await fetch(request);
    if (response.type === 'opaqueredirect' || response.status < 500) return response;
    return await fallback(url) || response;
  } catch {
    return await fallback(url) || new Response(isHome ? '目前無法連線，且沒有可用的離線頁面。請恢復網路後重新整理。' : 'Resource unavailable offline.', {
      status: 503,
      headers: {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store'}
    });
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== BASE.origin) return;
  if (request.mode === 'navigate') {
    if (url.pathname === BASE.pathname || url.pathname === new URL('index.html', BASE).pathname) event.respondWith(serve(request, HOME, true));
    return;
  }
  if (ASSETS.includes(url.href)) event.respondWith(serve(request, url.href, false));
});
