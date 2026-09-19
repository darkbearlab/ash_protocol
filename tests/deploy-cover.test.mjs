import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,deployCoverReason,DEPLOY_COVER,TERMINAL_ITEMS} from '../src/game.js';
import {PREPARED_CATALOG} from '../src/prepared.js';
import {BARRIER_TYPES,BARRIER_LIMIT,barrierBetween,vaultable,edgeBlocks} from '../src/barriers.js';
import {SAVE_VERSION} from '../src/data.js';

const run=()=>new Game(3,[],0,'soldier',undefined,'extraction');
const stocked=(n=2)=>{const g=run();g.player.barricades=n;return g;};
const openSide=g=>[[0,-1],[0,1],[-1,0],[1,0]].find(d=>!deployCoverReason(g,d));

test('the carried cover is a half cover on an edge, so it can always be crossed',()=>{
 const def=BARRIER_TYPES[DEPLOY_COVER];
 assert.ok(def,'it reuses a real barrier type');
 assert.equal(def.vaultable,true,'vaultable, so it can never seal a corridor');
 assert.equal(def.cover,true,'and it still counts as cover');
 assert.equal(def.sight,false,'a half cover does not block line of sight');
 assert.equal(def.shot,false);
 const entry=PREPARED_CATALOG.item.barricade;
 assert.equal(entry.action,'deployCover');
 assert.equal(entry.aim,'side','the UI has to ask for a side first');
 assert.ok(Object.hasOwn(run().player,entry.resource));
});

test('any of the four sides is one action, and the edge really appears there',()=>{
 const g=stocked(),p=g.player;
 const side=openSide(g);
 assert.ok(side,'at least one side is free on a normal floor');
 const turn=g.turn,facingBefore=[...p.facing];
 assert.equal(g.action('deployCover',side),true);
 assert.equal(g.turn,turn+1,'it costs one turn');
 assert.equal(p.barricades,1);
 const edge=barrierBetween(g.barriers,p,{x:p.x+side[0],y:p.y+side[1]});
 assert.ok(edge&&edge.type===DEPLOY_COVER&&edge.hp===BARRIER_TYPES[DEPLOY_COVER].maxHp);
 assert.ok(vaultable(edge),'and it can be vaulted from the moment it is placed');
 assert.ok(edgeBlocks(edge,'cover'));
 assert.equal(edgeBlocks(edge,'sight'),false);
 assert.deepEqual(p.facing,side,'you end up facing what you just built');
 assert.notDeepEqual(facingBefore,undefined);
});

test('it refuses what it cannot build, and never spends the turn doing so',()=>{
 const g=stocked(1),p=g.player;
 assert.match(deployCoverReason(g,null),/方向/);
 assert.match(deployCoverReason(g,[2,0]),/方向/);
 assert.equal(g.action('deployCover',null),false);
 assert.equal(p.barricades,1,'a refusal costs nothing');
 // A side that is not floor at all.
 const wall=[[0,-1],[0,1],[-1,0],[1,0]].find(d=>g.grid[p.y+d[1]]?.[p.x+d[0]]!==1);
 if(wall)assert.match(deployCoverReason(g,wall),/平地/);
 // The same side twice.
 const side=openSide(g);
 assert.equal(g.action('deployCover',side),true);
 assert.equal(p.barricades,0);
 p.barricades=1;
 assert.match(deployCoverReason(g,side),/已經有/);
 assert.equal(g.action('deployCover',side),false);
 assert.equal(p.barricades,1);
 // And with none carried nothing is offered at all.
 p.barricades=0;
 for(const d of [[0,-1],[0,1],[-1,0],[1,0]])assert.match(deployCoverReason(g,d),/沒有/);
});

test('a wreck is rebuilt in place, so the edge list never grows a duplicate',()=>{
 const g=stocked(2),p=g.player,side=openSide(g);
 assert.equal(g.action('deployCover',side),true);
 const spot={x:p.x+side[0],y:p.y+side[1]};
 const edge=barrierBetween(g.barriers,p,spot),id=edge.id,count=g.barriers.length;
 edge.hp=0;
 assert.equal(deployCoverReason(g,side),'','a destroyed one can be replaced');
 assert.equal(g.action('deployCover',side),true);
 const rebuilt=barrierBetween(g.barriers,p,spot);
 assert.equal(rebuilt.hp,BARRIER_TYPES[DEPLOY_COVER].maxHp);
 assert.equal(rebuilt.id,id,'and it keeps the id it already had');
 assert.equal(g.barriers.length,count,'no second entry on the same edge');
 assert.equal(new Set(g.barriers.map(b=>b.id)).size,g.barriers.length);
});

test('it never writes a floor the loader would reject',()=>{
 assert.equal(SAVE_VERSION,68);   // 3.148.0: perk D
 const g=stocked(3),p=g.player,side=openSide(g);
 assert.equal(g.action('deployCover',side),true);
 const back=Game.restore(g.serialize());
 assert.ok(back,'a floor with a deployed edge round-trips');
 assert.ok(barrierBetween(back.barriers,back.player,{x:p.x+side[0],y:p.y+side[1]}));
 assert.equal(back.player.barricades,2);
 // The loader caps the edge list; the rule refuses before it can be exceeded.
 const full=stocked(1);
 full.barriers=Array.from({length:BARRIER_LIMIT},(_,i)=>({id:`edge-filler-${i}`}));
 assert.match(deployCoverReason(full,openSide(stocked(1))||[0,1]),/太多/);
 // Older saves simply carry none.
 const legacy=JSON.parse(g.serialize());legacy.version=SAVE_VERSION-1;delete legacy.data.player.barricades;
 const old=Game.restore(JSON.stringify(legacy));
 assert.ok(old);
 assert.equal(old.player.barricades,0);
});

test('the terminal sells it like any other consumable',()=>{
 const offer=TERMINAL_ITEMS.barricade;
 assert.ok(offer&&offer.resource==='barricades');
 const g=run(),p=g.player;
 p.scrap=999;g.props.push({type:'terminal',x:p.x,y:p.y,used:false});
 assert.equal(g.useTerminal('barricade'),true);
 assert.equal(p.barricades,1);
});
