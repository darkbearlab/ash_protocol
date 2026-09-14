// This compares the temporary snapshot captured BEFORE this batch's edits. It never updates one.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {generate} from '../src/world.js';
const before=JSON.parse(fs.readFileSync(process.argv[2]||'qa/results/2026-09-14-swarm-unaffected-before.json','utf8'));
for(const [faction,seed,floor,hash] of before)assert.equal(crypto.createHash('sha256').update(JSON.stringify(generate(seed,floor,[],0,faction))).digest('hex'),hash,`${faction}:${seed}:${floor}`);
console.log(`${before.length} legacy/loyalist/rebel maps byte-identical to pre-change snapshot`);
