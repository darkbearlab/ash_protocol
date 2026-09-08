import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

test('generated sprites are real 32px indexed PNGs with <=16 palette entries and RGB5 colors',async()=>{
  const meta=JSON.parse(await readFile(new URL('../assets/pixel/atlas.json',import.meta.url),'utf8'));
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
