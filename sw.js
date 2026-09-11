const CACHE='bushtrack-v070-visual-fix1-cache';
const FILES=[
  './','./index.html','./style-v06.css','./style-v061.css','./visual-v070.css',
  './app-v06.js','./hotfix-v061.js','./stats-v064.js','./updatefix-v070.js','./visual-v070.js','./visualfix-v070.js',
  './manifest.webmanifest','./version.json','./icon-192.png','./icon-512.png','./apple-touch-icon.png',
  './fallback-v05.html','./style-v05.css','./app-v05.js','./fallback-v04.html','./style-v04.css','./app-v04.js',
  './assets/visual/bass.webp',
  './assets/visual/camp-sunset.webp',
  './assets/visual/country-map.webp',
  './assets/visual/creek-hero.webp',
  './assets/visual/deep-hole.webp',
  './assets/visual/deer-sign.webp',
  './assets/visual/deer.webp',
  './assets/visual/eel.webp',
  './assets/visual/hardbody.webp',
  './assets/visual/line.webp',
  './assets/visual/pig.webp',
  './assets/visual/rabbit.webp',
  './assets/visual/soft-plastic.webp',
  './assets/visual/spinnerbait.webp',
  './assets/visual/trail-camera.webp',
  './assets/visual/yabby-net.webp'
];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));
});

self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('bushtrack-')&&k!==CACHE).map(k=>caches.delete(k)))),
    self.clients.claim()
  ]));
});

async function textFrom(path){
  try{const r=await fetch(path,{cache:'no-store'});if(r.ok)return await r.text();}catch(e){}
  const cached=await caches.match(path);
  return cached?await cached.text():'';
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);

  if(url.pathname.endsWith('/version.json')){
    event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>caches.match(event.request)));
    return;
  }

  if(url.pathname.endsWith('/app-v06.js')){
    event.respondWith(
      Promise.all([
        textFrom('./app-v06.js'),
        textFrom('./hotfix-v061.js'),
        textFrom('./stats-v064.js'),
        textFrom('./updatefix-v070.js'),
        textFrom('./visual-v070.js'),
        textFrom('./visualfix-v070.js')
      ]).then(parts=>new Response(parts.join('\n\n'),{
        headers:{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store'}
      }))
    );
    return;
  }

  if(url.pathname.endsWith('/style-v06.css')){
    event.respondWith(
      Promise.all([
        textFrom('./style-v06.css'),
        textFrom('./style-v061.css'),
        textFrom('./visual-v070.css')
      ]).then(parts=>new Response(parts.join('\n\n'),{
        headers:{'Content-Type':'text/css; charset=utf-8','Cache-Control':'no-store'}
      }))
    );
    return;
  }

  event.respondWith(
    fetch(event.request).then(response=>{
      const copy=response.clone();
      caches.open(CACHE).then(c=>c.put(event.request,copy));
      return response;
    }).catch(async()=>{
      const cached=await caches.match(event.request);
      if(cached)return cached;
      if(event.request.mode==='navigate')return caches.match('./index.html');
      return new Response('',{status:404,statusText:'Not Found'});
    })
  );
});
