import assert from 'node:assert/strict';
// 3.210.0 (src/stale-runs.js, docs/CHECKLIST.md section 3): an unfinished run saved before RUN_SAVE_FLOOR is no longer
// migrated on load but settled as abandoned. The older migration tests still read such a save with Game.restore (the
// settlement uses it); through the storage they now check this instead: nothing comes back, the raw save is in the
// QA backup key, and the QA save key is gone.
export function assertDropped(storage,memory,raw){
 assert.equal(storage.loadGame(),null,'an old unfinished run is not continued');
 assert.equal(memory.get('qa-ash-save-abandoned'),raw,'its raw save is kept');
 assert.equal(memory.has('qa-ash-save'),false,'and the run is closed');
}
