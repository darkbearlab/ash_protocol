import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {THEMES,themeAt,resolveSprite} from '../src/themes.js';
import {Renderer} from '../src/renderer.js';

test('module appearances override room themes; unknown themes and missing roles fall back safely',()=>{
  const g={rooms:[{x:0,y:0,w:10,h:10,visualTheme:'utility'}],props:[{type:'module',theme:'restroom',x:3,y:3}]};
  assert.equal(themeAt(g,{x:1,y:1}),'utility');assert.equal(themeAt(g,{x:3,y:3}),'sanitary');g.props[0].visualTheme='unknown';assert.equal(themeAt(g,{x:3,y:3}),'industrial');
  assert.deepEqual(resolveSprite('unknown','cover'),resolveSprite('industrial','cover'));assert.equal(resolveSprite('industrial','unknown'),null);
  THEMES.test={...THEMES.industrial,roles:{floor:2}};assert.deepEqual(resolveSprite('test','terminal'),resolveSprite('industrial','terminal'));delete THEMES.test;
});
test('terrain drawing uses the correct semantic atlas cell, quarter-turn rotation and falls back when missing',()=>{
  const calls=[],ctx={save(){},restore(){},translate(...args){calls.push(['translate',...args]);},rotate(a){calls.push(['rotate',a]);},drawImage(...args){calls.push(['draw',...args]);}},g={props:[],rooms:[]};
  const r={ctx,game:g,tile:38,terrainImages:new Map()},sprite=resolveSprite('industrial','door');
  assert.equal(Renderer.prototype.terrain.call(r,'door',{x:50,y:50},{x:1,y:1}),false);
  const image={complete:true,naturalWidth:128};r.terrainImages.set(sprite.url,image);assert.equal(Renderer.prototype.terrain.call(r,'door',{x:50.2,y:50.3},{x:1,y:1},38,1),true);
  assert.equal(ctx.imageSmoothingEnabled,false);assert.deepEqual(calls[1],['rotate',Math.PI/2]);assert.deepEqual(calls[2].slice(2,6),[64,96,32,32]);assert.equal(Renderer.prototype.terrain.call(r,'unknown',{x:50,y:50},{x:1,y:1}),false);
});
test('all sixteen sprites use one indexed 32-color RGB555 palette and match the pipeline manifest',async()=>{
  const base=new URL('../assets/pixel/terrain-v1/',import.meta.url),meta=JSON.parse(await readFile(new URL('manifest.json',base),'utf8')),levels=new Set(Array.from({length:32},(_,i)=>Math.round(i*255/31)));assert.equal(Object.keys(meta.sprites).length,16);
  const atlas=await readFile(new URL('atlas.png',base));assert.equal(createHash('sha256').update(atlas).digest('hex'),meta.atlasSHA256);assert.equal(atlas.readUInt32BE(16),128);assert.equal(atlas.readUInt32BE(20),128);
  let shared;
  for(const [name,record]of Object.entries(meta.sprites)){
    const png=await readFile(new URL(`${name}.png`,base));assert.equal(png.readUInt32BE(16),32);assert.equal(png.readUInt32BE(20),32);assert.equal(png[25],3);assert.ok(record.colors<=32);assert.equal(createHash('sha256').update(png).digest('hex'),record.sha256);
    let palette,transparent=false;for(let pos=8;pos<png.length;){const length=png.readUInt32BE(pos),kind=png.toString('ascii',pos+4,pos+8),data=png.subarray(pos+8,pos+8+length);if(kind==='PLTE'){assert.ok(length<=96);assert.ok([...data].every(v=>levels.has(v)));palette=data;}if(kind==='tRNS'){assert.equal(data[0],0);transparent=true;}pos+=12+length;}
    assert.ok(transparent);if(shared)assert.deepEqual(palette,shared);shared=palette;
  }
  const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');assert.ok(sw.includes('./assets/pixel/terrain-v1/atlas.png'));assert.ok(sw.includes('./src/themes.js'));assert.ok(sw.includes('./src/traces.js'));
});
