import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {drawNest,NEST_ATLAS,drawNestEffect,NEST_EFFECT_MS} from '../src/nest-art.js';
test('both nest styles choose live/ruin frames without labels and render collapse without mutating state',()=>{
 const calls=[],c={drawImage(...args){calls.push(args);},fillRect(){},save(){},restore(){}},image={complete:true,naturalWidth:128};
 for(const x of [12,13]){
  const p={id:'nest-1-0',type:'nest',x,y:10,hp:45,nest:{active:false,remaining:6}},a={x:100,y:100};
  drawNest(c,image,a,40,p);assert.equal(calls.at(-1)[1],0);
  p.nest.active=true;drawNest(c,image,a,40,p);assert.equal(calls.at(-1)[1],32);
  p.hp=0;const before=JSON.stringify(p);drawNest(c,image,a,40,p);assert.equal(calls.at(-1)[1],96);assert.equal(JSON.stringify(p),before);
  const fx={type:'nestCollapse',nestStyle:x===12?'burrow':'rift'};drawNestEffect(c,image,fx,a,a,40,100);assert.equal(calls.at(-1)[1],64);
  const count=calls.length;drawNestEffect(c,image,fx,a,a,40,NEST_EFFECT_MS);assert.equal(calls.length,count);
 }
});
test('eight indexed 32px generated sprites and atlas are hash-checked and offline available',()=>{
 const dir=new URL('../assets/pixel/nests-v1/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('atlas.json',dir)));
 assert.equal(Object.keys(manifest.sprites).length,8);
 for(const [name,record]of Object.entries(manifest.sprites)){
  const png=readFileSync(new URL(name+'.png',dir));assert.equal(png.readUInt32BE(16),32);assert.equal(png.readUInt32BE(20),32);assert.equal(png[25],3);
  assert.equal(createHash('sha256').update(png).digest('hex'),record.sha256);
 }
 const atlas=readFileSync(new URL(NEST_ATLAS));assert.equal(atlas.readUInt32BE(16),128);assert.equal(atlas.readUInt32BE(20),64);
 assert.ok(readFileSync(new URL('../sw.js',import.meta.url),'utf8').includes('./assets/pixel/nests-v1/atlas.png'));
});
