import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CHARACTERS} from '../src/characters.js';
import {classSpriteRect} from '../src/class-art.js';

test('every playable class has distinct standing/dead 32px monochrome indexed art with transparent background',async()=>{
  const root=new URL('../assets/pixel/classes-v1/',import.meta.url),meta=JSON.parse(await readFile(new URL('atlas.json',root),'utf8')),hashes=new Set();
  assert.equal(Object.keys(meta.sprites).length,Object.keys(CHARACTERS).length*2);
  for(const character of Object.keys(CHARACTERS))for(const dead of [false,true]){
    const key=(dead?'dead-':'')+character,entry=meta.sprites[key],png=await readFile(new URL(key+'.png',root));
    assert.deepEqual(classSpriteRect(character,dead),{x:entry.x,y:entry.y,w:32,h:32});
    assert.equal(png.readUInt32BE(16),32);assert.equal(png.readUInt32BE(20),32);assert.equal(png[25],3);assert.equal(png[24],4);
    const hash=createHash('sha256').update(png).digest('hex');assert.equal(hash,entry.sha256);assert.ok(!hashes.has(hash));hashes.add(hash);
    let pos=8,transparent=false;while(pos<png.length){const len=png.readUInt32BE(pos),type=png.toString('ascii',pos+4,pos+8);if(type==='tRNS'){transparent=true;assert.equal(png[pos+8],0);}if(type==='PLTE'){assert.ok(len<=48);for(let j=pos+8;j<pos+8+len;j+=3){assert.equal(png[j],png[j+1]);assert.equal(png[j],png[j+2]);}}pos+=12+len;}assert.ok(transparent);
  }
});

for(const stem of ['atlas','aftermath'])test(`${stem} sprites are real 32px indexed PNGs with <=16 palette entries and RGB5 colors`,async()=>{
  const meta=JSON.parse(await readFile(new URL(`../assets/pixel/${stem}.json`,import.meta.url),'utf8'));
  const levels=new Set(Array.from({length:32},(_,n)=>Math.round(n*255/31)));
  assert.equal(Object.keys(meta.sprites).length,16);
  for(const [name,sprite]of Object.entries(meta.sprites)){
    const png=await readFile(new URL(`../assets/pixel/${name}.png`,import.meta.url));
    assert.equal(png.readUInt32BE(16),32);assert.equal(png.readUInt32BE(20),32);assert.equal(png[25],3);assert.equal(png[24],4);
    assert.ok(sprite.colors<=16);assert.equal(createHash('sha256').update(png).digest('hex'),sprite.sha256);
    assert.ok(sprite.palette.flat().every(c=>levels.has(c)));
    let pos=8,hasTransparency=false;while(pos<png.length){const len=png.readUInt32BE(pos),type=png.toString('ascii',pos+4,pos+8);if(type==='tRNS'){hasTransparency=true;assert.equal(png[pos+8],0);}if(type==='PLTE'){assert.ok(len<=48);assert.ok([...png.subarray(pos+8,pos+8+len)].every(c=>levels.has(c)));}pos+=12+len;}
    assert.ok(hasTransparency);
  }
});
