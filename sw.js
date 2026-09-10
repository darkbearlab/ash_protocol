const CACHE='ash-protocol-v3-33-0';
const FILES=['./','./index.html','./style.css','./expansion.css','./src/main.js','./src/controller.js','./src/engine.js','./src/data.js','./src/world.js','./src/barriers.js','./src/containers.js','./src/modules.js','./src/missions.js','./src/retreat.js','./src/traces.js','./src/themes.js','./src/walls.js','./src/art-tone.js','./src/materials.js','./src/material-selection.js','./src/material-review.js','./material-review.html','./src/combat.js','./src/cover.js','./src/lighting.js','./src/traits.js','./src/throwables.js','./src/prepared.js','./src/skills.js','./src/allies.js','./src/characters.js','./src/actor-stats.js','./src/portraits.js','./src/camera.js','./src/game.js','./src/storage.js','./src/progression.js','./src/ammunition.js','./src/weapons.js','./src/backup.js','./src/layout.js','./src/target-card.js','./src/presentation.js','./src/render.js','./src/renderer.js','./src/movement-boundaries.js','./src/audio.js','./assets/icon.svg','./assets/operator.svg','./assets/rifle.svg','./assets/lmg.svg','./assets/thunder.svg','./assets/powerfist.svg','./assets/shotgun.svg','./assets/smg.svg','./assets/sniper.svg','./assets/plasma.svg','./assets/launcher.svg','./assets/pixel/atlas.png','./assets/pixel/terrain-v1/atlas.png','./assets/pixel/walls-v1/atlas.png','./assets/pixel/aftermath.png','./assets/pixel/player.png','./assets/pixel/portraits/ember.png','./assets/pixel/portraits/onyx.png','./assets/pixel/portraits/silver.png','./assets/pixel/portraits/cedar.png','./assets/pixel/portraits/portrait-05.png','./assets/pixel/portraits/portrait-06.png','./assets/pixel/portraits/portrait-07.png','./assets/pixel/portraits/portrait-08.png','./assets/pixel/portraits/portrait-09.png','./assets/pixel/portraits/portrait-10.png','./assets/pixel/portraits/portrait-11.png','./assets/pixel/portraits/portrait-12.png','./assets/pixel/portraits/portrait-13.png','./assets/pixel/portraits/portrait-14.png','./assets/pixel/portraits/portrait-15.png','./assets/pixel/portraits/portrait-16.png','./manifest.webmanifest'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(url=>new Request(url,{cache:'reload'})))));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ash-protocol-')&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
// Only the entry document may ignore its query when offline. Asset hashes stay exact.
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url),entry=new URL('./',self.location.href);
  if(request.method!=='GET'||url.origin!==entry.origin)return;
  const navigation=request.mode==='navigate'&&(url.pathname===entry.pathname||url.pathname===new URL('index.html',entry).pathname);
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE).catch(()=>null);
    try{
      const response=await fetch(request,{cache:'no-cache'});
      if(response.ok){await cache?.put(request,response.clone()).catch(()=>{});return response;}
      if(!navigation)return response;
      return await cache?.match(request)||await cache?.match(new URL('index.html',entry).href)||response;
    }catch{
      return await cache?.match(request)||(navigation?await cache?.match(new URL('index.html',entry).href):null)||Response.error();
    }
  })());
});
