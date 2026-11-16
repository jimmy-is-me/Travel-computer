"use strict";
const CACHE='travel-computer-shell-v2-2';
const BASE=new URL('./',self.location.href);
const FILES=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./icon.svg'].map(p=>new URL(p,BASE).href);
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('travel-computer-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==BASE.origin)return;if(r.mode==='navigate'&&(u.pathname===BASE.pathname||u.pathname===new URL('index.html',BASE).pathname)){e.respondWith(caches.open(CACHE).then(c=>c.match(new URL('index.html',BASE).href)).then(hit=>hit||fetch(r)));return}if(FILES.includes(u.href))e.respondWith(caches.open(CACHE).then(c=>c.match(r)).then(hit=>hit||fetch(r)))});
