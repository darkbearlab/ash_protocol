import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

// 3.199.1 (user, 2026-09-28): the daily seed hashed the translated title, so English and Chinese players got different
// seeds on the same day. The language is chosen when modules load, so each language runs in its own process.
const seedIn=language=>{
 const env={...process.env};if(language)env.ASH_LANGUAGE=language;else delete env.ASH_LANGUAGE;
 const r=spawnSync(process.execPath,['--input-type=module','-e',`import {dailySeed,dailyMission} from './src/daily.js';import {language} from './src/i18n.js';import {MISSIONS} from './src/missions.js';const d=new Date(2026,8,28);console.log(JSON.stringify({language:language(),seed:dailySeed(d),mission:dailyMission(dailySeed(d),Object.keys(MISSIONS))}));`],{cwd:new URL('..',import.meta.url),env,encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);
};
test('the daily seed and mission are the same in every language',()=>{
 const zh=seedIn(null),en=seedIn('en');
 assert.equal(zh.language,'zh-TW');assert.equal(en.language,'en');
 assert.equal(en.seed,zh.seed);assert.equal(en.mission,zh.mission);
});
