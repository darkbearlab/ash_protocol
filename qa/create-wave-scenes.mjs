import fs from 'node:fs';
import {Game,generate,tickSwarmWaves,addPoison,tickPoison} from '../src/engine.js';
import {affixArena} from './enemy-affix-scenes.mjs';
const base=()=>{const g=affixArena();g.facilityFaction='swarm';g.floor=3;g.swarmWaves=structuredClone(generate(475,3,[],0,'swarm').swarmWaves);g.swarmWaves.origin={x:14,y:10};return g;};
export function waveScenes(){const dormant=base(),warning=base(),crowd=base(),poison=base();tickSwarmWaves(warning);for(let i=0;i<14;i++){crowd.turn++;tickSwarmWaves(crowd);}addPoison(poison.player,4);tickPoison(poison);return {dormant,warning,crowd,poison};}
const out='qa/fixtures/swarm-waves';fs.mkdirSync(out,{recursive:true});for(const [id,g]of Object.entries(waveScenes())){if(!Game.restore(g.serialize()))throw Error(`Invalid scene: ${id}`);fs.writeFileSync(`${out}/${id}.json`,g.serialize());console.log(`${out}/${id}.json`);}
