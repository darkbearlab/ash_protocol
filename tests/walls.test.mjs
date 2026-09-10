import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {wallStyle,wallGeometry,drawWall,WALL_FACES,WALL_CAPS} from '../src/walls.js';
import {Game} from '../src/game.js';
import {Renderer} from '../src/renderer.js';

function arena(){return {seed:321,floor:1,grid:Array.from({length:7},()=>Array(7).fill(1)),seen:Array.from({length:7},()=>Array(7).fill(true)),rooms:[]};}
function context(){const calls=[],stack=[];return {calls,globalAlpha:1,save(){stack.push(this.globalAlpha);},restore(){this.globalAlpha=stack.pop();},fillRect(...v){calls.push(['rect',this.globalAlpha,...v]);},drawImage(...v){calls.push(['image',this.globalAlpha,...v]);}};}

test('every wall brick has a half-tile face plus full-tile cap in all 16 neighbor configurations',()=>{
  for(let mask=0;mask<16;mask++){
    const g=arena();g.grid[3][3]=0;[[0,-1],[1,0],[0,1],[-1,0]].forEach(([dx,dy],i)=>{if(mask&(1<<i))g.grid[3+dy][3+dx]=0;});
    const q=wallGeometry(g,3,3,32,{x:112,y:112});assert.equal(q.faceHeight,16);assert.equal(q.height,32);assert.equal(q.bottom-q.capTop,48);assert.deepEqual(q.neighbors,[0,1,2,3].map(i=>!!(mask&(1<<i))));
    const c=context();drawWall(c,g,3,3,32,{x:112,y:112},{complete:true,naturalWidth:128});const draws=c.calls.filter(v=>v[0]==='image');assert.equal(draws.length,2);assert.deepEqual(draws.map(v=>v.slice(-2)),[[32,16],[32,32]]);
  }
  // Fractional zoom/camera positions still join at precisely the same rounded boundary.
  const g=arena(),t=38*1.13,a=wallGeometry(g,3,3,t,{x:109.2,y:111.7}),b=wallGeometry(g,3,4,t,{x:109.2,y:111.7+t});assert.equal(a.groundTop,b.capTop);
});
test('solid caps project half a tile upward and never change with exploration; context is restored',()=>{
  const g=arena();g.grid[3][3]=0;const image={complete:true,naturalWidth:128},c=context();c.globalAlpha=.36;
  let q=drawWall(c,g,3,3,32,{x:112,y:112},image);assert.equal(q.capTop,80);assert.deepEqual(c.calls.filter(c=>c[0]==='image').map(c=>c[1]),[.36,.36]);assert.equal(c.globalAlpha,.36);assert.deepEqual(c.calls[0],['rect',1,96,80,32,48]);
  g.seen[2][3]=false;q=drawWall(context(),g,3,3,32,{x:112,y:112},image);assert.equal(q.capTop,80);
  g.grid[2][3]=0;g.seen[2][3]=true;assert.equal(wallGeometry(g,3,3,32,{x:112,y:112}).capTop,80);
  const fallback=context();drawWall(fallback,g,3,3,32,{x:112,y:112},null);assert.ok(fallback.calls.some(c=>c[0]==='rect'));assert.equal(fallback.globalAlpha,1);
});
test('64 face/cap combinations remain independent, safe and deterministic without changing a save or RNG',()=>{
  const g=new Game(321),before=g.serialize();for(let y=0;y<20;y++)for(let x=0;x<20;x++){const a=wallStyle(g,x,y);assert.deepEqual(wallStyle(g,x,y),a);assert.match(a.face,/^W0[1-8]$/);assert.match(a.cap,/^W(09|1[0-6])$/);}assert.equal(g.serialize(),before);
  const restored=Game.restore(before);assert.deepEqual(wallStyle(restored,8,8),wallStyle(g,8,8));
  const a=arena();a.rooms=[{x:2,y:2,w:3,h:3,wallStyle:{}}];for(let face=0;face<8;face++)for(let cap=0;cap<8;cap++){a.rooms[0].wallStyle={face:WALL_FACES[face],cap:WALL_CAPS[cap]};assert.deepEqual(wallStyle(a,3,3),{face:'W'+String(face+1).padStart(2,'0'),cap:'W'+String(cap+9).padStart(2,'0')});}
  a.rooms[0].wallStyle={face:'../../bad',cap:'bogus'};assert.deepEqual(wallStyle(a,3,3,'unknown'),wallStyle(a,3,3,'industrial'));
});
test('full battlefield draw stages walls after props, actors and effects and retains cardinal picking',()=>{
  const g=new Game(321);g.player.x=10;g.player.y=10;g.grid[10][11]=0;g.grid[10][10]=1;g.seen[10][10]=true;g.visibleTiles.add('10,10');g.traces=[{x:10,y:10,kind:'blood',variant:0,rotation:0}];g.props.push({id:'test',type:'cover',x:10,y:10,hp:65,maxHp:65});
  const stages=[],gradient={addColorStop(){}},ctx=new Proxy({globalAlpha:1,fillRect(){if(this.fillStyle==='#54292b')stages.push('trace');},createRadialGradient(){return gradient;}},{get(o,k){return k in o?o[k]:()=>{};},set(o,k,v){o[k]=v;return true;}});
  const r=Object.create(Renderer.prototype);Object.assign(r,{ctx,game:g,tile:38,w:300,h:400,dpr:1,camera:{x:10,y:10},effects:[{type:'fall',time:0,from:{x:10,y:10},to:{x:10,y:10}}],reduceMotion:true,targetingEnabled:false,effectSprite(){stages.push('effect');},terrain(){return true;},wall(){stages.push('wall');},prop(){stages.push('prop');},actor(){stages.push('actor');},corpse(){},item(){},drawBarrier(){},hazard(){},exit(){},terrainReady:true});
  r.draw(0);assert.ok(stages.indexOf('wall')>=0);assert.ok(stages.indexOf('wall')>stages.lastIndexOf('prop'));assert.ok(stages.indexOf('wall')>stages.lastIndexOf('actor'));assert.ok(stages.includes('trace'));assert.ok(stages.indexOf('wall')>stages.lastIndexOf('trace'));assert.ok(stages.includes('effect'));assert.ok(stages.indexOf('wall')>stages.lastIndexOf('effect'));
  const p=r.project(11,10);assert.deepEqual(r.unproject(p.x,p.y),{x:11,y:10});assert.equal(p.y,200);assert.equal(p.x,188);
});
test('generated wall PNGs match their manifest and share an indexed RGB555 palette; offline resources included',async()=>{
  const base=new URL('../assets/pixel/walls-v1/',import.meta.url),meta=JSON.parse(await readFile(new URL('manifest.json',base),'utf8')),levels=new Set(Array.from({length:32},(_,i)=>Math.round(i*255/31)));assert.equal(Object.keys(meta.sprites).length,16);let shared;
  for(const [name,record]of Object.entries(meta.sprites)){
    const png=await readFile(new URL(name+'.png',base));assert.equal(png.readUInt32BE(16),32);assert.equal(png.readUInt32BE(20),32);assert.equal(png[25],3);assert.ok(record.colors<=32);assert.equal(createHash('sha256').update(png).digest('hex'),record.sha256);
    for(let p=8;p<png.length;){const n=png.readUInt32BE(p);if(png.toString('ascii',p+4,p+8)==='PLTE'){const palette=png.subarray(p+8,p+8+n);assert.ok(n<=96);assert.ok([...palette].every(v=>levels.has(v)));if(shared)assert.deepEqual(palette,shared);shared=palette;}p+=n+12;}
  }
  const atlas=await readFile(new URL('atlas.png',base));assert.equal(createHash('sha256').update(atlas).digest('hex'),meta.atlasSHA256);
  const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');assert.ok(sw.includes('./src/walls.js'));assert.ok(sw.includes('./assets/pixel/walls-v1/atlas.png'));
});
