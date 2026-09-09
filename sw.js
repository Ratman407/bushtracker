const CACHE='bushtrack-v06-cache';
const KEEP=['bushtrack-v06-cache','bushtrack-v05-cache','bushtrack-v04-fallback-cache','bushtrack-v04-cache'];
const FILES=['./','./index.html','./style-v06.css','./app-v06.js','./manifest.webmanifest','./version.json','./icon-192.png','./icon-512.png','./apple-touch-icon.png','./fallback-v05.html','./style-v05.css','./app-v05.js','./fallback-v04.html','./style-v04.css','./app-v04.js'];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)))});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>!KEEP.includes(k)).map(k=>caches.delete(k)))),self.clients.claim()]))});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.pathname.endsWith('/version.json')){event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>caches.match(event.request)));return;}
  event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return response;}).catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html'))));
});
