import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
// Drawing-command equality + identical source PNGs preserves the old raster inputs,
// transforms, alpha, clipping and draw order without depending on a browser's GPU.
export function styleContract({themes,walls,barriers}){
 const clean=url=>String(url).replace(/^.*\/assets\//,'assets/');
 const sprites=[];for(const theme of Object.keys(themes.THEMES))for(const role of ['floor','cover','barrel','door','terminal','locker','toilet','counter']){const s=themes.resolveSprite(theme,role);sprites.push([theme,role,s&&{...s,url:clean(s.url)}]);}
 const calls=[],ctx=new Proxy({globalAlpha:1},{get:(o,k)=>k in o?o[k]:(...args)=>calls.push([k,...args.map(a=>a?.url?clean(a.url):a)]),set:(o,k,v)=>{calls.push(['set',k,v]);o[k]=v;return true;}});
 const urls=[...new Set(sprites.map(s=>s[2]?.url).filter(Boolean)),'assets/pixel/walls-v1/atlas.png','assets/pixel/doors-v1/atlas.png'];
 const images=new Map(urls.map(url=>[new URL('../'+url,import.meta.url).href,{url,complete:true,naturalWidth:128}]));
 for(const seed of [0,27,909])for(const theme of ['industrial','sanitary','security','utility']){const grid=Array.from({length:7},()=>Array(7).fill(1));grid[3][3]=0;grid[2][3]=0;walls.drawWall(ctx,{grid,seed,floor:3,rooms:[]},3,3,38,{x:100.2,y:91.4},images,theme);}
 for(const axis of ['x','y'])for(const open of [false,true])barriers.drawDoor(ctx,{axis,open,hp:50},{x:112,y:98},38,images);
 const hashes=Object.fromEntries(urls.map(url=>[url,createHash('sha256').update(readFileSync(new URL('../'+url,import.meta.url))).digest('hex')]));
 return {sprites,calls,hashes};
}
