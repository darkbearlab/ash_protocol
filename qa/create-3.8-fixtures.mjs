// External QA only. No browser or localStorage access; import with ?test=1.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
const output=new URL('./fixtures/3.8/',import.meta.url);await mkdir(output,{recursive:true});
function arena(){const g=new Game(380);g.runId=`qa-weapons-${Date.now()}`;g.barriers=[];g.grid=Array.from({length:SIZE},(_,y)=>Array.from({length:SIZE},(_,x)=>Number(x>0&&y>0&&x<SIZE-1&&y<SIZE-1)));Object.assign(g.player,{x:10,y:10,scrap:200});g.enemies=[];g.items=[];g.props=[];g.hazards=[];g.marks=[];g.rooms=[];g.end={x:20,y:20};return g;}
function loot(g,base,affix,x=11,y=10){const item=g.registerWeapon({type:'weapon',weapon:base,x,y});g.player.affixes[item.slot]=affix;g.player.ammo[item.slot]=g.weaponAt(item.slot).mag;g.items.push(item);return item.slot;}
async function save(name,g){g.reveal();if(!Game.restore(g.serialize()))throw new Error(`Invalid ${name}`);await writeFile(new URL(`${name}.json`,output),g.serialize());}
const pack=arena();pack.addWeapon(2);pack.player.ammo[0]=2;pack.player.upgrades[0]=2;
for(const affix of ['stable','piercing','extended','powerful','longbarrel','tracking'])loot(pack,0,affix);
pack.items.push({type:'scrap',x:9,y:10},{type:'shell',x:10,y:9,amount:6});await save('comparison-full-pack',pack);
const combat=arena(),gun=loot(combat,0,'tracking');combat.takeWeapon(gun);combat.player.weapon=gun;combat.enemies=[makeEnemy('brute',15,10,'qa-target')];combat.target='qa-target';await save('affix-combat',combat);
const old=JSON.parse(arena().serialize());old.version=4;old.data.carryLevel=0;old.data.player.ammo=[2,3,0,0,0,0];old.data.player.upgrades=[2,1,0,0,0,0];delete old.data.player.weaponBases;delete old.data.player.affixes;old.data.items=[{type:'weapon',weapon:0,x:11,y:10}];
if(!Game.restore(JSON.stringify(old)))throw new Error('Invalid legacy fixture');await writeFile(new URL('legacy-v4.json',output),JSON.stringify(old));
console.log('Created three QA-only weapon fixtures in qa/fixtures/3.8/.');
