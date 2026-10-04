// 3.223.0 units-v2 (docs/UNIT_SPRITES_HANDOFF.md): the units that borrowed another's cell draw their own, appended to
// both atlases by tools/append_units_v2.py.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ENEMY_TYPES} from '../src/data.js';
import {UNIT_SPRITES_V2,SPRITE_NAMES,AFTERMATH_NAMES,enemySprite,enemyTint} from '../src/enemy-visuals.js';

const root=new URL('../assets/pixel/',import.meta.url),meta=JSON.parse(await readFile(new URL('units-v2/sprites.json',root),'utf8'));
const levels=new Set(Array.from({length:32},(_,n)=>Math.round(n*255/31))),OUTLINE='12,14,18';
function chunks(png){const out={};let pos=8;while(pos<png.length){const len=png.readUInt32BE(pos),type=png.toString('ascii',pos+4,pos+8);out[type]??=png.subarray(pos+8,pos+8+len);pos+=12+len;}return out;}

test('units-v2 sprites are real 32px 4-bit indexed PNGs: index 0 transparent, binary alpha, RGB5 colours plus the outline',async()=>{
 const hashes=new Set();
 for(const id of UNIT_SPRITES_V2)for(const name of [id,`dead-${id}`]){
  const png=await readFile(new URL(`units-v2/${name}.png`,root)),c=chunks(png),entry=meta.sprites[name];
  assert.ok(entry,name);
  assert.deepEqual([c.IHDR.readUInt32BE(0),c.IHDR.readUInt32BE(4),c.IHDR[8],c.IHDR[9]],[32,32,4,3],name);
  assert.ok(c.PLTE.length<=48,name);assert.equal(c.tRNS[0],0,name);
  assert.ok([...c.tRNS].every((a,i)=>i===0?a===0:a===255),`${name}: only index 0 is transparent`);
  for(let i=3;i<c.PLTE.length;i+=3){const rgb=[c.PLTE[i],c.PLTE[i+1],c.PLTE[i+2]];assert.ok(rgb.join()===OUTLINE||rgb.every(v=>levels.has(v)),`${name} colour ${rgb}`);}
  const hash=createHash('sha256').update(png).digest('hex');assert.equal(hash,entry.sha256,name);assert.ok(!hashes.has(hash),name);hashes.add(hash);
 }
 assert.equal(hashes.size,UNIT_SPRITES_V2.length*2);
});

test('both atlases carry the 22 units after their 18 old cells, in one order, as tools/append_units_v2.py wrote them',async()=>{
 assert.deepEqual(meta.atlasOrder,[...UNIT_SPRITES_V2]);
 assert.deepEqual(SPRITE_NAMES.slice(18),[...UNIT_SPRITES_V2]);assert.deepEqual(AFTERMATH_NAMES.slice(18),UNIT_SPRITES_V2.map(id=>`dead-${id}`));
 assert.deepEqual(SPRITE_NAMES.slice(16,18),['civilian','spitter']);assert.deepEqual(AFTERMATH_NAMES.slice(16,18),['dead-civilian','dead-spitter']);
 for(const stem of ['atlas','aftermath']){
  const png=await readFile(new URL(`${stem}.png`,root)),c=chunks(png);
  assert.deepEqual([c.IHDR.readUInt32BE(0),c.IHDR.readUInt32BE(4)],[128,320],stem);   // 40 cells, 4 to a row
  assert.equal(createHash('sha256').update(png).digest('hex'),meta.atlases[stem].sha256,stem);
 }
});

test('every unit that borrowed a cell draws its own now; only the elites and the delisted operatives keep a borrowed look',()=>{
 const own=['designator','gunline','arsonist','burnline','hive_beast','hive_matriarch','fodder','brood','giant_bug','turret','munition','bomber_bot','heavy_flamer','enforcer','squad_leader','gunner','rifleman_infected','raider_infected','rifleman_armored','raider_armored'];
 for(const id of own){const look=enemySprite(id);assert.deepEqual([look.key,look.corpse],[id,id],id);assert.equal(enemyTint({type:id}),null,`${id} has its colours in the art`);}
 const borrowed=Object.keys(ENEMY_TYPES).filter(id=>enemySprite(id).key!==id).sort();
 assert.deepEqual(borrowed,['delisted_berserker','delisted_engineer','delisted_ninja','delisted_recon','delisted_soldier','gunner_elite','raider_elite']);
 assert.equal(enemySprite('gunner_elite').key,'gunner');assert.equal(enemySprite('raider_elite').key,'raider');
 // Sizes stay the cards': the big bugs and the heavy flamer are drawn enlarged, the larva small.
 assert.deepEqual(['hive_beast','hive_matriarch','giant_bug','heavy_flamer','brood','fodder'].map(id=>enemySprite(id).size),[1.55,1.7,1.3,1.25,.65,1]);
});

test('who the unit is picks the dog, the sentry, the munition and the companion beast; the rules types stay',()=>{
 const look=a=>{const s=enemySprite(a.type,a);return `${s.key}/${s.corpse}`;};
 assert.equal(look({type:'crawler',faction:'loyalist'}),'dog/dog');assert.equal(look({type:'crawler',faction:'rebel'}),'dog/dog');
 assert.equal(look({type:'crawler',faction:'swarm'}),'crawler/crawler');assert.equal(look({type:'crawler'}),'crawler/crawler');
 assert.equal(look({type:'drone',kind:'drone',sourceId:'drone_sentry'}),'turret/turret');
 assert.equal(look({type:'drone',kind:'drone',sourceId:'drone_munition'}),'munition/munition');
 assert.equal(look({type:'drone',kind:'drone',sourceId:'drone_follow'}),'drone/drone');assert.equal(look({type:'drone',kind:'drone',sourceId:'unit_drone'}),'drone/drone');
 assert.equal(look({type:'bomber_bot',kind:'drone',sourceId:'unit_bomber'}),'bomber_bot/bomber_bot');
 assert.equal(look({type:'warden',kind:'drone',sourceId:'unit_warden'}),'warden/warden');assert.equal(look({type:'boss',kind:'drone',sourceId:'unit_boss'}),'boss/boss');
 assert.equal(look({type:'crawler',kind:'pet',sourceId:'pet_command'}),'pet/pet');
 assert.equal(look({type:'raider',kind:'summon',sourceId:'raise_dead'}),'raider/raider');
 assert.equal(look({type:'player'}),'player/player');
 // Without the unit (the codex, a card on its own) the card's own cell: the crawler card is still the bug.
 assert.equal(enemySprite('crawler').key,'crawler');assert.equal(enemySprite('drone').key,'drone');
});
