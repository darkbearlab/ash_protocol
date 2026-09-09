import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../sw.js',import.meta.url),'utf8');
function worker(base='https://example.test/ash_protocol/',{online=null,brokenCache=false,quota=false}={}){
  const handlers={},entries=new Map(),other=new Map();
  const url=r=>new URL(typeof r==='string'?r:r.url,base).href;
  const cache={match:async r=>entries.get(url(r))?.clone(),put:async(r,v)=>{if(quota)throw Error('quota');entries.set(url(r),v);}};
  vm.runInNewContext(source,{URL,Request,Response,self:{location:new URL('sw.js?v=current',base),addEventListener:(k,fn)=>handlers[k]=fn},caches:{open:async()=>{if(brokenCache)throw Error('disabled');return cache;},match:async r=>other.get(url(r))},fetch:async()=>{if(online)return online.clone();throw Error('offline');}});
  return {entries,other,async request(path,mode='navigate',method='GET'){
    let result;handlers.fetch({request:{url:new URL(path,base).href,mode,method},respondWith:p=>result=p});return result===undefined?undefined:await result;
  }};
}
test('offline query entry falls back to precached index in both project and root scopes',async()=>{
  for(const base of ['https://example.test/ash_protocol/','https://example.test/']){
    const w=worker(base);w.entries.set(new URL('index.html',base).href,new Response('current shell'));
    for(const path of ['./?test=1&v=unvisited','./?v=old-bookmark','./index.html?test=1'])assert.equal(await(await w.request(path)).text(),'current shell');
  }
});
test('assets remain hash-exact and never receive an HTML or stale-cache fallback',async()=>{
  const w=worker(),base='https://example.test/ash_protocol/';w.entries.set(base+'index.html',new Response('shell'));w.entries.set(base+'src/game.js?v=current',new Response('current module'));w.other.set(base+'src/game.js?v=old',new Response('stale module'));
  assert.equal(await(await w.request('./src/game.js?v=current','cors')).text(),'current module');
  for(const path of ['./src/game.js?v=missing','./src/game.js?v=old','./missing.html','./other/?test=1','./index.html.bak'])assert.equal((await w.request(path,path.includes('.js')?'cors':'navigate')).type,'error');
  assert.equal((await w.request('./?test=1','cors')).type,'error');
  assert.equal(await w.request('https://another.test/'),undefined);assert.equal(await w.request('./','navigate','POST'),undefined);
});
test('online responses update the current cache, while HTTP entry failures can use the shell',async()=>{
  const w=worker(undefined,{online:new Response('new shell')});assert.equal(await(await w.request('./?v=new')).text(),'new shell');assert.equal(w.entries.size,1);
  const failed=worker(undefined,{online:new Response('unavailable',{status:503})});failed.entries.set('https://example.test/ash_protocol/index.html',new Response('offline shell'));
  assert.equal(await(await failed.request('./?v=new')).text(),'offline shell');assert.equal((await failed.request('./src/game.js?v=new','cors')).status,503);
});
test('unavailable or full cache does not prevent online play; missing offline shell fails explicitly',async()=>{
  for(const options of [{brokenCache:true},{quota:true}])assert.equal(await(await worker(undefined,{...options,online:new Response('online')}).request('./')).text(),'online');
  assert.equal((await worker().request('./?v=unknown')).type,'error');
});
