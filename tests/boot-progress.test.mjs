import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';

// The start-up bar (3.198.3, user): it counts real file loads, so its total must be exactly the code the page imports.
const read=async p=>readFile(new URL(p,import.meta.url),'utf8');
async function importGraph(){
 const seen=new Set();
 const walk=async file=>{if(seen.has(file))return;seen.add(file);const body=await read(`../src/${file}`);
  for(const m of body.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]\.\/([\w-]+\.js)['"]|import\s*['"]\.\/([\w-]+\.js)['"]/g))await walk(m[1]||m[2]);};
 await walk('main.js');return seen;
}
test('the boot screen counts the files of the import graph, and nothing loads later on demand',async()=>{
 const html=await read('../index.html'),graph=await importGraph();
 const total=Number(/class="boot-screen"[^>]*data-modules="(\d+)"/.exec(html)?.[1]);
 assert.equal(total,graph.size,'data-modules matches the modules src/main.js pulls in');
 assert.match(html,new RegExp(`<span class="boot-count">0 / ${total}</span>`));
 const files=(await readdir(new URL('../src/',import.meta.url))).filter(f=>f.endsWith('.js'));
 for(const f of files)assert.doesNotMatch(await read(`../src/${f}`),/import\s*\(/,`${f}: a dynamic import would load after the bar is gone`);
 // The watcher reads real resource timing, and sits before every stylesheet: an inline script after one waits for it
 // (Google Fonts included) and holds up the page and the game's code with it (3.198.4).
 const watcher=html.indexOf("watch.observe({type:'resource',buffered:true})");
 assert.ok(watcher>0&&watcher<html.indexOf('<link rel="stylesheet"'),'before the stylesheets');
 assert.equal((html.match(/<script>/g)||[]).length,1,'no other inline script');
 const css=await read('../expansion.css');assert.ok(css.includes('.boot-screen:not(.boot-counting) .boot-bar,.boot-screen:not(.boot-counting) .boot-count{visibility:hidden}'),'no bar without the timing API');
});
