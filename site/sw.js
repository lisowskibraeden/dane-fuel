const CACHE='dane-fuel-shell-v8';
const SHELL=['./','./index.html','./style.css','./app.js','./model.js','./minimum.js','./terminal.js','./icon-192.png','./icon-512.png','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('dane-fuel-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin!==self.location.origin||e.request.method!=='GET')return;
 // Price data is network-only: a cached response must never appear freshly retrieved.
 if(u.pathname.includes('/data/'))return;
 e.respondWith(fetch(e.request).catch(()=>caches.match(e.request).then(r=>r||Response.error())));
});
