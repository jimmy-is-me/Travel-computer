"use strict";
const BASE = new URL('./', self.location.href);
const PREFIX = 'travel-computer-shell-' + BASE.pathname + ':';
const CACHE = PREFIX + 'v2-4';
const INDEX = new URL('index.html', BASE).href;
const FILES = ['index.html', 'styles.css', 'responsive.css', 'app.js', 'ui.js', 'manifest.webmanifest', 'icon.svg'].map(file => new URL(file, BASE).href);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(url => new Request(url, {cache: 'reload', redirect: 'error'})))));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.allSettled(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function cached(url) {
  try {
    const response = await (await caches.open(CACHE)).match(url);
    return response && response.ok && !response.redirected ? response : null;
  } catch {
    return null;
  }
}

async function networkFirst(request, fallback, navigation) {
  try {
    const response = await fetch(request, {cache: 'no-cache'});
    if (response.status < 500) return response;
    return await cached(fallback) || response;
  } catch {
    return await cached(fallback) || new Response(navigation ? '目前無法連線，且尚無可用的離線頁面。請恢復網路後重新整理。' : 'Resource unavailable offline.', {
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
    if (url.pathname === BASE.pathname || url.pathname === new URL(INDEX).pathname) {
      event.respondWith(networkFirst(request, INDEX, true));
    }
    return;
  }
  if (FILES.includes(url.href)) event.respondWith(networkFirst(request, url.href, false));
});
