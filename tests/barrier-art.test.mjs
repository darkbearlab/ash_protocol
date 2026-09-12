import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {barrierJunctions,barrierEndpoints,drawJunction,doorGeometry,drawDoor,DOOR_ATLAS} from '../src/barrier-art.js';
import {Renderer} from '../src/renderer.js';
const edge=(axis,x,y,type='partition')=>({axis,x,y,type,hp:60});
test('L, T and cross connectors follow live edges while collinear or destroyed panels leave no phantom joint',()=>{
  const a=edge('x',1.5,1),b=edge('y',2,1.5),c=edge('x',1.5,2),d=edge('y',1,1.5,'low_partition');
  for(const parts of [[a,b],[a,b,c],[a,b,c,d]]){const j=barrierJunctions(parts);assert.equal(j.length,1);assert.deepEqual([j[0].x,j[0].y],[1.5,1.5]);assert.equal(j[0].edges.length,parts.length);}
  assert.deepEqual(barrierJunctions([a,c]),[]);assert.deepEqual(barrierJunctions([a,{...b,hp:0}]),[]);
  const open={...b,type:'door',open:true};assert.equal(barrierJunctions([a,open]).length,1,'open jamb still physically meets panel');
  assert.deepEqual(barrierEndpoints(b),[{x:1.5,y:1.5},{x:2.5,y:1.5}]);
});
test('raised doors and connector posts use textures without rotating faces; open span stays visually and hit-test clear',()=>{
  const ctx={save(){},restore(){},drawImage(...args){this.calls.push(args);},fillRect(){},calls:[]},images=new Map([[DOOR_ATLAS,{complete:true,naturalWidth:64}]]);
  for(const axis of ['x','y']){
    const b=edge(axis,1,1,'door'),center={x:100,y:100};ctx.calls=[];drawDoor(ctx,b,center,32,images);assert.equal(ctx.calls.length,2);assert.equal(doorGeometry(b,center,32)[0].height,16);
    b.open=true;ctx.calls=[];drawDoor(ctx,b,center,32,images);assert.equal(ctx.calls.length,4);
    const boxes=doorGeometry(b,center,32),r={game:{barriers:[b],visible:()=>true},tile:32,project:()=>center};
    assert.equal(Renderer.prototype.hitBarrier.call(r,100,axis==='x'?92:88),undefined,'click through central open span');
    assert.equal(Renderer.prototype.hitBarrier.call(r,boxes[0].left+1,boxes[0].top+1),b);
    assert.equal(ctx.imageSmoothingEnabled,false);
  }
  const j={edges:[edge('x',1.5,1),edge('y',2,1.5)]};const q=drawJunction(ctx,j,{x:100,y:100},32,new Map());assert.equal(q.height,16);assert.ok(q.width>=5);
});
test('door art is opaque 32px indexed texture with one RGB555 palette and reproducible source hashes',()=>{
  const root=new URL('../assets/pixel/doors-v1/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('atlas.json',root)));let palette;
  assert.equal(Object.keys(manifest.sprites).length,4);const levels=new Set(Array.from({length:32},(_,i)=>Math.round(i*255/31)));
  for(const [name,entry]of Object.entries(manifest.sprites)){
    const png=readFileSync(new URL(`${name}.png`,root));assert.equal(png.readUInt32BE(16),32);assert.equal(png.readUInt32BE(20),32);assert.equal(png[25],3);assert.equal(createHash('sha256').update(png).digest('hex'),entry.sha256);
    for(let p=8;p<png.length;){const n=png.readUInt32BE(p);if(png.toString('ascii',p+4,p+8)==='PLTE'){const colors=png.subarray(p+8,p+8+n);assert.ok(n<=96);assert.ok([...colors].every(v=>levels.has(v)));if(palette)assert.deepEqual(colors,palette);palette=colors;}p+=n+12;}
  }
  const source=readFileSync(new URL('../art/doors-v1/source-atlas.png',import.meta.url));assert.equal(createHash('sha256').update(source).digest('hex'),manifest.source_sha256);
});
