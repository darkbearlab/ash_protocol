import {mkdirSync,writeFileSync} from 'node:fs';
import {Game} from '../src/game.js';
import {affixScenes} from './enemy-affix-scenes.mjs';
mkdirSync('qa/fixtures',{recursive:true});
for(const [name,value] of Object.entries(affixScenes())){const raw=value instanceof Game?value.serialize():JSON.stringify(value);if(!Game.restore(raw))throw new Error(`Invalid fixture ${name}`);const path=`qa/fixtures/affix-${name}.json`;writeFileSync(path,raw);console.log(path);}
