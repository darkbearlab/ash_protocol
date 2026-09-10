// 德魯伊寵物三波連戰（3.37.0 起）：第 3 層空房，玩家照常開火、清完一波才去回收倒地的狗，
// 升級一律選第一個強化。人工場景，不代表自然平衡。
// 用法：node qa/pet-waves.mjs [src 目錄 ...]，預設為本倉庫 src；每個目錄輸出一列，可並列比較新舊版。
// 比較舊版：git archive <舊 SHA> src | tar -x -C <暫存目錄>，再把 <暫存目錄>/src 當參數。
import {pathToFileURL, fileURLToPath} from 'node:url';
import {join, dirname} from 'node:path';

const load = async src => { const u = p => pathToFileURL(join(src, p)).href; return {...await import(u('game.js')), ...await import(u('data.js')), ...await import(u('world.js')), ...await import(u('allies.js')), ...await import(u('lighting.js'))}; };
const WAVES = [{at: 1, foes: [['crawler', 14, 10], ['crawler', 14, 14], ['raider', 15, 12]]}, {at: 26, foes: [['rifleman', 13, 10], ['rifleman', 13, 14], ['gunner', 14, 12]]}, {at: 51, foes: [['crawler', 14, 10], ['crawler', 14, 14], ['raider', 15, 12]]}];
const d = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function run(m, seed) {
  const {Game, SIZE, makeEnemy, addAlly, fullLighting} = m;
  const g = new Game(seed, [], 0, 'druid', 'onyx');
  g.grid = Array.from({length: SIZE}, () => Array(SIZE).fill(0));
  for (let y = 6; y <= 18; y++) for (let x = 2; x <= 22; x++) g.grid[y][x] = 1;
  for (const k of ['allies', 'enemies', 'props', 'items', 'barriers', 'hazards', 'marks', 'rooms', 'traces', 'smoke']) g[k] = [];
  g.allySerial = 0; g.floor = 3; g.lighting = fullLighting(g.grid); g.seen = g.grid.map(r => r.map(() => true));
  Object.assign(g.player, {x: 5, y: 12, hp: 999, maxHp: 999}); g.start = {x: 1, y: 1}; g.end = {x: 25, y: 25};
  const pet = addAlly(g, 'pet', 'crawler', {sourceId: 'pet_command', point: {x: 6, y: 12}}); g.reveal();
  let dealt = 0, kills = 0, downs = 0, returns = 0, onField = 0, wasOut = false;
  const hit = g.hitTarget.bind(g);
  g.hitTarget = (e, dmg, attacker, ...rest) => { const hp = e.hp, r = hit(e, dmg, attacker, ...rest); if (attacker === pet) { dealt += Math.max(0, hp - Math.max(0, e.hp)); if (hp > 0 && e.hp <= 0) kills++; } return r; };
  for (let t = 1; t <= 75 && g.status === 'playing'; t++) {
    for (const w of WAVES) if (w.at === t) for (const [type, x, y] of w.foes) { if (g.enemies.some(o => o.hp > 0 && o.x === x && o.y === y) || (pet.status === 'active' && pet.x === x && pet.y === y)) continue; const e = makeEnemy(type, x, y, `w${t}-${g.enemies.length}`, 3); e.alert = true; g.enemies.push(e); }
    while (g.pendingPerks) g.choosePerk(g.perkChoices[0].id);
    g.reveal();
    const p = g.player, wpn = g.weapon, live = g.enemies.filter(e => e.hp > 0);
    const target = live.filter(e => g.visible(e) && g.shotClear(p, e) && d(e, p) <= wpn.range).sort((a, b) => d(a, p) - d(b, p))[0];
    if (target && p.ammo[p.weapon] > 0) { g.target = target.id; g.action('fire'); }
    else if (!live.length && pet.status === 'down' && pet.floor === g.floor) {
      if (!(d(pet, p) <= 1 && g.action('usePrepared', {category: 'skill'}))) { const step = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => d({x: p.x + dx, y: p.y + dy}, pet) < d(p, pet) && g.passable(p.x + dx, p.y + dy)); if (!step || !g.action('move', step)) g.action('wait'); }
    }
    else if (p.ammo[p.weapon] < wpn.mag && p[g.reserveKey()] > 0) g.action('reload');
    else g.action('wait');
    const out = pet.status !== 'active';
    if (pet.status === 'down' && !wasOut) downs++;
    if (!out && wasOut) returns++;
    if (!out && live.length) onField++;
    wasOut = out;
  }
  return {dealt, kills, downs, returns, onField};
}

const sources = process.argv.slice(2).length ? process.argv.slice(2) : [join(dirname(fileURLToPath(import.meta.url)), '..', 'src')];
const SEEDS = Array.from({length: 30}, (_, i) => 201 + i);
console.log('| src | 狗造成傷害 | 狗擊殺 | 倒地次數 | 回到戰場次數 | 有敵人時狗在場的回合 |');
console.log('| --- | ---: | ---: | ---: | ---: | ---: |');
for (const src of sources) {
  const m = await load(src), rs = SEEDS.map(s => run(m, s)), avg = f => (rs.reduce((s, r) => s + f(r), 0) / rs.length);
  console.log(`| ${src} | ${avg(r => r.dealt).toFixed(0)} | ${avg(r => r.kills).toFixed(2)} | ${avg(r => r.downs).toFixed(2)} | ${avg(r => r.returns).toFixed(2)} | ${avg(r => r.onField).toFixed(1)} |`);
}
