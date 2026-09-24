import test from 'node:test';
import assert from 'node:assert/strict';
import {t} from '../src/i18n.js';
import {Game,generate} from '../src/engine.js';
import {reachable} from '../src/world.js';
import {edgeCells,barrierName} from '../src/barriers.js';
import {isBossClass,isNoncombatant,enemyDef} from '../src/enemy-data.js';
import {VAULT_TUNING,VAULT_LOOT,vaultCapable,sealVaultWalls} from '../src/vault.js';
import {moduleCells} from '../src/modules.js';
import {WEAPONS} from '../src/data.js';

// 3.146.0 (user decisions 2026-09-19, docs/VAULTS.md): keycards and locked vaults.
const key=p=>`${p.x},${p.y}`;
const vaultOf=m=>({door:m.barriers.find(b=>b.vault),box:m.props.find(p=>p.kind==='vault'),carrier:m.enemies.find(e=>e.keycard)});
const inside=m=>{const all=reachable(m,m.start,{keys:true}),out=reachable(m,m.start);return [...all].filter(k=>!out.has(k));};
function vaultRun(character='soldier'){
 for(let seed=1;seed<200;seed++){const g=new Game(seed,[],0,character,'onyx','extraction');if(g.barriers.some(b=>b.vault))return g;}
 throw new Error('no vault in 200 seeds');
}
// Put the player on the outside cell of the vault door, facing in.
function atDoor(g){
 const door=g.barriers.find(b=>b.vault),out=reachable(g,g.start),[a,b]=edgeCells(door),outside=out.has(key(a))?a:b,inner=outside===a?b:a;
 Object.assign(g.player,{x:outside.x,y:outside.y});g.enemies=[];g.reveal();return {door,dir:[inner.x-outside.x,inner.y-outside.y],inner};
}

test('about a third of floors 1-6 have a vault; each is a closet with nothing that must stay reachable',()=>{
 let floors=0,vaults=0;
 for(let seed=1;seed<=60;seed++)for(let floor=1;floor<=6;floor++){
  floors++;const m=generate(seed,floor),{door,box,carrier}=vaultOf(m);if(!door){assert.ok(!box&&!carrier);continue;}vaults++;
  assert.equal(m.barriers.filter(b=>b.vault).length,1);
  assert.deepEqual([door.type,door.locked,door.indestructible,door.open],['door',true,true,false]);
  const tiles=new Set(inside(m));
  assert.ok(tiles.size>=1&&tiles.size<=VAULT_TUNING.maxTiles,`${seed}/${floor}: a closet, ${tiles.size} tiles`);
  assert.ok(tiles.has(key(box)),'the vault case is behind the door');
  assert.ok(![m.start,m.end,...m.enemies,...m.items].some(o=>tiles.has(key(o))),'nobody and nothing loose is locked in');
  assert.ok(!(m.slots||[]).some(s=>['objective','terminal','weapon'].includes(s.kind)&&tiles.has(key(s))));
  assert.ok(!m.props.filter(p=>p.type==='module').flatMap(moduleCells).some(q=>key(q)===key(box)),'the case is not on a fixture');
  assert.equal(m.enemies.filter(e=>e.keycard).length,1);
  assert.ok(!isBossClass(carrier)&&!isNoncombatant(carrier)&&!enemyDef(carrier)?.expendable);
  assert.equal(box.contents.length,1);
 }
 assert.ok(vaults/floors>.25&&vaults/floors<.42,`${vaults}/${floors}`);
});

test('an elite carries the keycard when the floor has one',()=>{
 let checked=0;
 for(let seed=1;seed<=60;seed++)for(let floor=7;floor<=12;floor++){
  const m=generate(seed,floor),{carrier}=vaultOf(m);if(!carrier)continue;
  if(m.enemies.some(e=>e.elite&&!isBossClass(e)&&!isNoncombatant(e)&&!e.horde&&!enemyDef(e)?.expendable&&!['bomber','munition'].includes(enemyDef(e)?.behavior))){assert.ok(carrier.elite,`${seed}/${floor}`);checked++;}
 }
 assert.ok(checked>0);
});

test('the high-rarity list: an exoskeleton, a plasma rifle with a drop-only affix, or carry-expansion data',()=>{
 assert.deepEqual(VAULT_LOOT.map(l=>l.id),['exo','plasma','extended_carry']);
 const seen=new Set();
 for(let seed=1;seed<=80;seed++)for(let floor=1;floor<=6;floor++){const box=generate(seed,floor).props.find(p=>p.kind==='vault');if(!box)continue;const i=box.contents[0];seen.add(i.type==='weapon'?`plasma:${i.affix}`:i.type);}
 for(const id of ['exo','learning','plasma:lance','plasma:burst','plasma:rapid'])assert.ok(seen.has(id),id);
});

test('nothing spawns or is placed in a vault: without the keycard its tiles are not reachable',()=>{
 const g=vaultRun(),tiles=inside(g);
 assert.ok(tiles.length);
 assert.ok(!g.enemies.some(e=>tiles.includes(key(e))));
 assert.equal(reachable(g,g.start,{keys:true}).size,reachable(g,g.start).size+tiles.length);
});

test('locked: you cannot open it without this floor\'s keycard, enemies cannot, and nothing breaks it',()=>{
 const g=vaultRun(),p=g.player,{door,dir,inner}=atDoor(g);
 const turn=g.turn;assert.equal(g.action('move',dir),false,'walking into it is refused');assert.equal(g.turn,turn,'and costs nothing');
 assert.equal(g.action('door',{id:door.id,open:true}),false);
 p.keycards=[g.floor+1];assert.equal(g.action('move',dir),false,'another floor\'s card does not fit');
 assert.equal(g.setDoor(door,true),false,'enemies, civilians and allies open doors through setDoor');
 assert.equal(g.canRoute({x:p.x,y:p.y},inner),false,'and never path through it');
 g.damageProp(door,999,g.player);g.explode({x:p.x,y:p.y},2,200);
 assert.equal(door.hp,door.maxHp,'shots, breakers and blasts do nothing');assert.ok(door.locked&&!door.open);
});

test('the carrier drops the keycard; picking it up opens the door once, and the card is spent',()=>{
 const g=vaultRun(),p=g.player,carrier=g.enemies.find(e=>e.keycard);
 g.hurt(carrier,99999,g.player);
 const card=g.items.find(i=>i.type==='key');assert.ok(card,'it drops whatever kills the carrier');
 Object.assign(p,{x:card.x,y:card.y});g.pickup();
 assert.deepEqual(p.keycards,[g.floor]);assert.ok(!g.items.some(i=>i.type==='key'));
 const {door,dir}=atDoor(g);
 assert.ok(g.action('move',dir),'walking into it unlocks and opens it');
 assert.deepEqual([door.locked,door.open],[false,true]);assert.deepEqual(p.keycards,[]);
 assert.ok(g.action('door',{id:door.id,open:false}),'afterwards an ordinary door');assert.ok(g.action('door',{id:door.id,open:true}));
 g.damageProp(door,999,g.player);assert.equal(door.hp,door.maxHp,'still steel');
});

test('what the vault holds, and what becomes scrap when you cannot use it',()=>{
 const open=(character,item,setup=()=>{})=>{
  const g=vaultRun(character),p=g.player,box=g.props.find(c=>c.kind==='vault');box.contents=[item];setup(p);
  const scrap=p.scrap;Object.assign(p,{x:box.x,y:box.y});g.enemies=[];assert.ok(g.openContainer(box.id));const pos=g.items[g.items.length-1];Object.assign(p,{x:pos.x,y:pos.y});g.pickup();return {g,p,gained:p.scrap-scrap};
 };
 let r=open('soldier',{type:'exo'});assert.ok(r.p.wearables.includes('exo'));assert.equal(r.p.exoPlates,50);
 r=open('bulwark',{type:'exo'});assert.ok(!r.p.wearables.includes('exo'));assert.ok(r.gained>=VAULT_TUNING.fallbackScrap,'too large to wear it: scrap');
 r=open('soldier',{type:'exo'},p=>{p.wearables.push('exo');p.exoPlates=10;});assert.equal(r.p.exoPlates,10,'you already have one: scrap');assert.ok(r.gained>=VAULT_TUNING.fallbackScrap);
 const PL=WEAPONS.findIndex(w=>w.id==='plasma');
 r=open('soldier',{type:'weapon',weapon:PL,affix:'lance'});const slot=r.p.weaponBases.lastIndexOf(PL);
 if(slot>=0)assert.equal(r.p.affixes[slot],'lance','the plasma rifle keeps its affix');else assert.ok(r.gained>=VAULT_TUNING.fallbackScrap,'not unlocked: scrap');
 r=open('soldier',{type:'learning',learningId:'trait_extended_carry'});assert.equal(r.p.learningItems.trait_extended_carry,1);
});

test('saves carry the vault and the card, and refuse forged ones',()=>{
 const g=vaultRun(),carrier=g.enemies.find(e=>e.keycard);
 const back=Game.restore(g.serialize());assert.ok(back);
 assert.ok(back.barriers.find(b=>b.vault).locked);assert.ok(back.enemies.find(e=>e.id===carrier.id).keycard);
 const forge=f=>{const raw=JSON.parse(g.serialize());f(raw.data);return Game.restore(JSON.stringify(raw));};
 assert.equal(forge(d=>{d.barriers.find(b=>b.vault).open=true;}),null,'locked and open');
 assert.equal(forge(d=>{delete d.barriers.find(b=>b.vault).indestructible;}),null,'a vault door that breaks');
 assert.equal(forge(d=>{d.barriers.find(b=>!b.vault&&!b.vaultWall).indestructible=true;}),null,'an ordinary door made unbreakable');
 assert.equal(forge(d=>{for(const e of d.enemies.filter(e=>!e.keycard).slice(0,1))e.keycard=true;}),null,'two carriers');
 assert.equal(forge(d=>{d.player.keycards=[1,1];}),null);
 assert.equal(forge(d=>{d.props.find(p=>p.kind==='vault').contents=[{type:'ammo',amount:999}];}),null,'a vault holds only the list');
 const legacy=JSON.parse(g.serialize());legacy.version=66;delete legacy.data.player.keycards;
 for(const b of legacy.data.barriers)if(b.vault||b.vaultWall){delete b.vault;delete b.locked;delete b.indestructible;delete b.vaultWall;}
 for(const e of legacy.data.enemies)delete e.keycard;legacy.data.props=legacy.data.props.filter(p=>p.kind!=='vault');
 const old=Game.restore(JSON.stringify(legacy));assert.ok(old);assert.deepEqual(old.player.keycards,[]);
});

test('a floor that can hold a vault is common on floors 1-6',()=>{
 let n=0,capable=0;for(let seed=1;seed<=40;seed++)for(let floor=1;floor<=6;floor++){n++;if(vaultCapable(generate(seed,floor)))capable++;}
 assert.ok(capable/n>.7,`${capable}/${n}`);
});

// 3.177.2 (user report 2026-09-24): the door held but the closet's partitions could be shot open. Its walls are sealed
// with it; saves from before keep their run and get the seal on load.
const sealedRuns=()=>{const out=[];for(let seed=1;seed<400&&out.length<6;seed++){const g=new Game(seed,[],0,'soldier','onyx','extraction');if(g.barriers.some(b=>b.vaultWall))out.push(g);}return out;};
test("the closet's walls are sealed with its door, and nothing else is",()=>{
 const runs=sealedRuns();assert.ok(runs.length>=3,`closets walled by partitions: ${runs.length}`);
 for(const g of runs){
  const room=new Set(inside(g)),crosses=b=>{const [a,c]=edgeCells(b);return room.has(key(a))!==room.has(key(c));};
  for(const b of g.barriers){
   if(b.vault)continue;
   assert.equal(Boolean(b.vaultWall),b.hp>0&&crosses(b),`${g.seed} ${b.id}`);
   if(b.vaultWall)assert.deepEqual([b.indestructible,b.type!=='door'],[true,true]);
  }
 }
});

test('shots, breakers and blasts do nothing to a sealed wall',()=>{
 const g=sealedRuns()[0],wall=g.barriers.find(b=>b.vaultWall),[a]=edgeCells(wall);
 g.damageProp(wall,999,g.player);g.explode(a,2,200);
 assert.equal(wall.hp,wall.maxHp);
 assert.equal(barrierName(wall),t('barriers.vaultWall'),'the target card names it');
});

test('saves keep the seal, refuse forged ones, and seal the closets of older saves',()=>{
 const g=sealedRuns()[0],sealed=g.barriers.filter(b=>b.vaultWall).map(b=>b.id).sort();
 const back=Game.restore(g.serialize());assert.deepEqual(back.barriers.filter(b=>b.vaultWall).map(b=>b.id).sort(),sealed);
 const forge=f=>{const raw=JSON.parse(g.serialize());f(raw.data);return Game.restore(JSON.stringify(raw));};
 assert.equal(forge(d=>{Object.assign(d.barriers.find(b=>b.type==='door'&&!b.vault),{indestructible:true,vaultWall:true});}),null,'a door is never a vault wall');
 assert.equal(forge(d=>{delete d.barriers.find(b=>b.vaultWall).indestructible;}),null,'a vault wall that breaks');
 assert.equal(forge(d=>{for(const b of d.barriers)if(b.vault){delete b.vault;delete b.locked;delete b.indestructible;}}),null,'sealed walls with no vault');
 const old=JSON.parse(g.serialize());old.version=71;
 for(const b of old.data.barriers)if(b.vaultWall){delete b.vaultWall;delete b.indestructible;}
 const loaded=Game.restore(JSON.stringify(old));assert.ok(loaded,'an older save still loads');
 assert.deepEqual(loaded.barriers.filter(b=>b.vaultWall).map(b=>b.id).sort(),sealed,'and its closet is sealed');
 // A floor kept for the way back is sealed the same way; one already broken into stays open.
 const frame=structuredClone({grid:g.grid,start:g.start,barriers:g.barriers});
 for(const b of frame.barriers)if(b.vaultWall){delete b.vaultWall;delete b.indestructible;}
 frame.barriers.find(b=>b.id===sealed[0]).hp=0;
 sealVaultWalls(frame);
 assert.deepEqual(frame.barriers.filter(b=>b.vaultWall).map(b=>b.id).sort(),[],'a broken wall opens the closet, so there is nothing left to seal');
});
