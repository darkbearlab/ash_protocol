import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ART_TONES,tonePixel,tonePixels,ArtToneCache} from '../src/art-tone.js';
import {MATERIALS,MATERIAL_SELECTION,approved,validateSelection,materialSprite,TERRAIN_ATLAS,WALL_ATLAS} from '../src/materials.js';
import {wallStyle,drawWall} from '../src/walls.js';
import {resolveSprite} from '../src/themes.js';

test('semantic tone keeps alpha, clamps color, dims props/walls and separates unit saturation',()=>{
  assert.deepEqual(tonePixel([100,100,100],'wall'),[72,72,72]);assert.deepEqual(tonePixel([100,100,100],'prop'),[80,80,80]);assert.deepEqual(tonePixel([100,100,100],'unit'),[130,130,130]);
  const rgb=tonePixel([140,60,35],'unit');assert.ok(rgb[0]-rgb[2]>140-35);assert.ok(tonePixel([255,0,0],'unit').every(v=>v>=0&&v<=255));
  const data=new Uint8ClampedArray([10,20,30,0,100,100,100,255]);tonePixels(data,'wall');assert.deepEqual([...data],[10,20,30,0,72,72,72,255]);assert.equal(ART_TONES.floor.contrast,.72);
});
test('floor swatches normalize to the same quiet brightness, including bright restroom and reassigned materials',()=>{
  for(const level of [30,50,74,120]){const data=new Uint8ClampedArray([level,level,level,255]);tonePixels(data,'floor');assert.ok(data[0]>=69&&data[0]<=71);assert.equal(data[3],255);}
  const data=new Uint8ClampedArray([32,32,32,255,72,72,72,255]);tonePixels(data,'floor');assert.ok(data[4]-data[0]<40);
});
test('tone cache processes a sprite once per role and source; source image pixels remain untouched',()=>{
  const prior=globalThis.document;let reads=0,writes=0;const original=new Uint8ClampedArray([100,100,100,255]);
  globalThis.document={createElement(){return {getContext(){return {drawImage(){},getImageData(){reads++;return {data:new Uint8ClampedArray(original)};},putImageData(){writes++;}};}};}};
  try{const cache=new ArtToneCache(),image={complete:true,naturalWidth:128},cell={x:0,y:0,size:32};assert.equal(cache.get({complete:false},cell,'wall'),null);const wall=cache.get(image,cell,'wall');assert.equal(cache.get(image,cell,'wall'),wall);assert.notEqual(cache.get(image,cell,'floor'),wall);assert.equal(reads,2);assert.equal(writes,2);assert.deepEqual([...original],[100,100,100,255]);}finally{globalThis.document=prior;}
});
test('approval config rejects empty pools, duplicates, unknown IDs and paths; generated config matches editable source',async()=>{
  assert.equal(Object.keys(MATERIALS).length,20);const saved=JSON.parse(await readFile(new URL('../art/materials/selection.json',import.meta.url),'utf8'));assert.deepEqual(validateSelection(saved),MATERIAL_SELECTION);
  for(const bad of [{...saved,version:2},{...saved,floor:[]},{...saved,face:['W01','W01']},{...saved,cap:['../../secret']},{...saved,floor:'T01'}])assert.throws(()=>validateSelection(bad));
  const copy=validateSelection(saved);copy.floor.push('W01');assert.notDeepEqual(copy.floor,saved.floor);
});
test('cross-role approvals swap terrain and walls in the real draw path and override legacy room preferences',()=>{
  const selection=validateSelection({version:1,floor:['W03'],face:['T02'],cap:['T01']}),g={seed:1,floor:1,grid:[[1,1,1],[1,0,1],[1,1,1]],rooms:[{x:0,y:0,w:3,h:3,wallStyle:{face:'armored',cap:'steel'}}]};
  assert.equal(approved('floor','T01',selection),'W03');assert.deepEqual(wallStyle(g,1,1,'industrial',selection),{face:'T02',cap:'T01'});
  const terrain={complete:true,naturalWidth:128},wall={complete:true,naturalWidth:128},images=new Map([[TERRAIN_ATLAS,terrain],[WALL_ATLAS,wall]]),calls=[],ctx={save(){},restore(){},fillRect(){},drawImage(...a){calls.push(a);}};
  drawWall(ctx,g,1,1,32,{x:48,y:48},images,'industrial',null,selection);assert.equal(calls.length,2);assert.ok(calls.every(c=>c[0]===terrain));assert.equal(calls[0][1],32);assert.equal(calls[1][1],0);
  const original=[...MATERIAL_SELECTION.floor];try{MATERIAL_SELECTION.floor=['W03'];assert.deepEqual(resolveSprite('sanitary','floor'),materialSprite('W03'));}finally{MATERIAL_SELECTION.floor=original;}
});
test('review page is standalone and never uses campaign/profile storage; it uses the shared renderer and exports validated JSON',async()=>{
  const body=await readFile(new URL('../src/material-review.js',import.meta.url),'utf8'),html=await readFile(new URL('../material-review.html',import.meta.url),'utf8');assert.ok(body.includes('drawWall(c,g'));assert.ok(body.includes('validateSelection(draft)'));assert.ok(body.includes("a.download='selection.json'"));assert.ok(!/localStorage|sessionStorage|ash-save|ash-profile/.test(body));
  for(const id of ['catalog','scene','floor','face','cap','tone','download','load','reset','import','status'])assert.ok(html.includes('id="'+id+'"'));const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');for(const file of ['art-tone.js','materials.js','material-selection.js','material-review.js'])assert.ok(sw.includes('./src/'+file));assert.ok(sw.includes('./material-review.html'));
});
