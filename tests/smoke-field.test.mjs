import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceFamily} from './helpers/source.mjs';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {FIELD_FILES,FX_FIELD,SMOKE_QUALITIES,smokeQuality,fxField} from '../src/fx-sprites.js';

// 3.202.0 (user 2026-09-29): smoke drawn as one field from a large texture, layered at run time or pre-stacked, picked in
// the settings; art/smoke-field-v1 holds the sources, prompts and the deterministic processing.
const root=new URL('../',import.meta.url),levels=new Set(Array.from({length:32},(_,i)=>Math.round(i*255/31)));
function chunks(png){const out={};for(let p=8;p<png.length;){const n=png.readUInt32BE(p),type=png.toString('ascii',p+4,p+8);out[type]=png.subarray(p+8,p+8+n);p+=n+12;}return out;}

test('the smoke setting: layered unless the pre-stacked one was chosen',()=>{
  assert.deepEqual(SMOKE_QUALITIES,['layers','baked']);
  for(const [stored,want] of [[null,'layers'],[undefined,'layers'],['layers','layers'],['baked','baked'],['fancy','layers']])assert.equal(smokeQuality(stored),want);
  assert.equal(fxField('smoke','layers'),null,'no textures outside a browser: the clouds keep the per-tile drawing');
});

test('the smoke textures are 4-bit indexed, RGB5, at most 16 colours, index 0 clear, and cached offline',async()=>{
  const sw=await readFile(new URL('sw.js',root),'utf8'),server=await readFile(new URL('server.mjs',root),'utf8');
  assert.ok(server.includes('smoke-field-v1'),'the dev server serves the folder');
  assert.equal(FIELD_FILES.length,1+FX_FIELD.kinds.length);
  for(const file of FIELD_FILES){
    const png=await readFile(new URL(file,root)),c=chunks(png),[w,h]=[c.IHDR.readUInt32BE(0),c.IHDR.readUInt32BE(4)];
    assert.deepEqual([c.IHDR[8],c.IHDR[9]],[4,3],file+': 4-bit indexed');
    assert.deepEqual([w,h],file.endsWith('layers.png')?[FX_FIELD.size*FX_FIELD.kinds.length,FX_FIELD.size]:[FX_FIELD.size,FX_FIELD.size],file);
    assert.ok(c.PLTE.length/3<=16&&[...c.PLTE].every(v=>levels.has(v)),file+': RGB5, 16 colours at most');
    assert.equal(c.tRNS[0],0,file+': index 0 is transparent');
    assert.ok(sw.includes(file),file+' is cached for offline play');
  }
});

test('the sources and outputs match the recorded processing, and the pre-stacked textures use the run-time stack',async()=>{
  const art=new URL('art/smoke-field-v1/',root),manifest=JSON.parse(await readFile(new URL('manifest.json',art),'utf8'));
  for(const [file,hash] of Object.entries(manifest.files))assert.equal(createHash('sha256').update(await readFile(new URL('assets/pixel/smoke-field-v1/'+file,root))).digest('hex'),hash,file);
  for(const [file,hash] of Object.entries(manifest.sources))assert.equal(createHash('sha256').update(await readFile(new URL(file,art))).digest('hex'),hash,file);
  // art/smoke-field-v1/process.py bakes with the renderer's numbers: the same offsets, opacities and veil.
  const py=await readFile(new URL('process.py',art),'utf8'),js=sourceFamily('renderer');
  const stack=js.slice(js.indexOf('const FIELD_STACKS='),js.indexOf('baked:{',js.indexOf('const FIELD_STACKS=')));
  for(const [x,y,alpha] of [...py.matchAll(/\(\((\d+), (\d+)\), ([.\d]+),/g)].map(m=>m.slice(1)))assert.ok(stack.includes(`at:[${x},${y}]`)&&stack.includes(`alpha:${alpha}`),`${x},${y} at ${alpha}`);
  assert.ok(/VEIL = \.5\b/.test(py)&&stack.includes('veil:.5'));
});
