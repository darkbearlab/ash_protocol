import fs from 'node:fs';
import {Game} from '../src/engine.js';
import {affixArena} from './enemy-affix-scenes.mjs';
export function swarmScenes(){
 const prepared=affixArena();prepared.facilityFaction='swarm';const boss=prepared.spawnEnemy('hive_beast',14,10,'qa-tongue');boss.alert=true;prepared.enemies.push(boss);prepared.reveal();prepared.enemyAct(boss);
 const venom=affixArena();venom.facilityFaction='swarm';venom.player.poison=6;const spitter=venom.spawnEnemy('spitter',14,10,'qa-spitter');spitter.alert=true;venom.enemies.push(spitter);venom.reveal();
 const infection=affixArena();infection.facilityFaction='swarm';const host=infection.spawnEnemy('rifleman_infected',14,10,'qa-host');host.alert=true;infection.enemies.push(host);infection.reveal();
 const natural=new Game(475,[],0,'soldier','onyx','extraction',{facilityFaction:'swarm'});natural.floor=3;natural.loadFloor();
 return {prepared,venom,infection,natural};
}
if(process.argv[1]?.endsWith('create-swarm-scenes.mjs')){const out='qa/fixtures/swarm';fs.mkdirSync(out,{recursive:true});for(const [id,g]of Object.entries(swarmScenes())){if(!Game.restore(g.serialize()))throw Error(`Invalid ${id}`);fs.writeFileSync(`${out}/${id}.json`,g.serialize());console.log(`${id}: ${out}/${id}.json`);}}
