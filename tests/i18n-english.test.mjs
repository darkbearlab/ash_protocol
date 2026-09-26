import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

// 3.167.0: a short English run in a child process (the language is chosen when modules load). What the player reads
// must hold no Chinese, apart from the shelved classes, which are not translated yet. 3.190.0: the story fragments are
// ENCRYPTED placeholders in both languages, so a data pickup reads English too.
const script=`
import {Game} from './src/engine.js';
import {play} from './tools/balance.mjs';
import {language,t} from './src/i18n.js';
import {WEAPONS} from './src/data.js';
const texts=[];
class Run extends Game{
 log(text,danger,real=null){texts.push(text);if(real!==null)texts.push(real);return super.log(text,danger,real);}
 fail(text,...rest){texts.push(text);return super.fail(text,...rest);}
}
for(const [character,seed] of [['soldier',1],['berserker',2]])play(seed,400,character,Run);
console.log(JSON.stringify({language:language(),reload:t('game.reloaded',{n:2}),rifle:WEAPONS[0].name,texts}));
`;

test('an English run reads English',()=>{
 const r=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:new URL('..',import.meta.url),env:{...process.env,ASH_LANGUAGE:'en'},encoding:'utf8',maxBuffer:64*1024*1024});
 assert.equal(r.status,0,r.stderr);
 const out=JSON.parse(r.stdout.trim().split('\n').pop());
 assert.equal(out.language,'en');
 assert.equal(out.reload,'Reloaded 2 rounds.');
 assert.equal(out.rifle,'Assault Rifle');   // 3.177.10: the user dropped the brand names
 assert.ok(out.texts.length>50,'the bots played');
 const chinese=out.texts.filter(text=>/[一-鿿]/.test(text));
 assert.deepEqual(chinese,[]);
});
