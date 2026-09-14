import {mkdirSync,writeFileSync} from 'node:fs';
import {Game} from '../src/game.js';
import {realModeScenes} from './real-mode-scenes.mjs';
mkdirSync('qa/fixtures',{recursive:true});
for(const [name,g] of Object.entries(realModeScenes())){const raw=g.serialize();if(!Game.restore(raw))throw new Error(`Invalid fixture ${name}`);const path=`qa/fixtures/real-mode-${name}.json`;writeFileSync(path,raw);console.log(path);}
