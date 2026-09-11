import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VERSION} from '../src/version.js';

// 3.44.1: the version lives in src/version.js; `npm run bump -- x.y.z` keeps the other two copies in step.
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('package.json, src/version.js and the sw.js cache name carry the same version', () => {
  assert.equal(JSON.parse(read('package.json')).version, VERSION);
  assert.ok(read('sw.js').includes(`const CACHE='ash-protocol-v${VERSION.replaceAll('.', '-')}';`));
});

test('player-facing BUILD labels read the version instead of typing it', () => {
  assert.doesNotMatch(read('src/controller.js'), /BUILD \d+\.\d+\.\d+/);
  assert.match(read('src/controller.js'), /BUILD \$\{VERSION\}/);
});
