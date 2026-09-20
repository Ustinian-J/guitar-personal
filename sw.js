// Build injects an exact content version and the complete same-origin app shell.
const PREFIX='xianxu-personal:'+new URL(self.registration.scope).pathname+':';
const CACHE=PREFIX+"xianxu-personal-bc38af322b38";
const FILES=["./index.html","./style.css","./app.js","./model.js","./db.js","./data.json","./manifest.webmanifest","./icons/icon.svg","./icons/icon-192.png","./icons/icon-512.png"];
const scope=new URL(self.registration.scope);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);if(req.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
  // Only our known files enter cache. No video, external pages or personal records.
  const relative=url.pathname.slice(scope.pathname.length)||'index.html';if(req.mode!=='navigate'&&!FILES.includes('./'+relative))return;
  event.respondWith((async()=>{const cache=await caches.open(CACHE);if(req.mode==='navigate')return (await cache.match('./index.html'))||fetch(req);return (await cache.match(url.pathname))||fetch(req);})());
});
