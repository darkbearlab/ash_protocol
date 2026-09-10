// 工程師追隨無人機三波連戰（3.39.0 起）：第 3 層空房，玩家照常開火，備彈用開局預設值；
// 清完一波若無人機剩彈少於一半，玩家回收再部署補彈。升級一律選第一個強化。人工場景，不代表自然平衡。
// 用法：node qa/drone-waves.mjs [src 目錄 ...]，預設為本倉庫 src；每個目錄輸出一列。
// 比較舊版：git archive <舊 SHA> src | tar -x -C <暫存目錄>，再把 <暫存目錄>/src 當參數。
import {pathToFileURL, fileURLToPath} from 'node:url';
import {join, dirname} from 'node:path';

const load = async src => { const u = p => pathToFileURL(join(src, p)).href; return {...await import(u('game.js')), ...await import(u('data.js')), ...await import(u('world.js')), ...await import(u('allies.js')), ...await import(u('lighting.js'))}; };
const WAVES = [{at: 1, foes: [['crawler', 14, 10], ['crawler', 14, 14], ['raider', 15, 12]]}, {at: 26, foes: [['rifleman', 13, 10], ['rifleman', 13, 14], ['gunner', 14, 12]]}, {at: 51, foes: [['crawler', 14, 10], ['crawler', 14, 14], ['raider', 15, 12]]}];
const d = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function run(m, seed) {
  const {Game, SIZE, makeEnemy, addAlly, fullLighting, allyWeapon} = m;
  const g = new Game(seed, [], 0, 'engineer', 'onyx');
  g.grid = Array.from({length: SIZE}, () => Array(SIZE).fill(0));
  for (let y = 6; y <= 18; y++) for (let x = 2; x <= 22; x++) g.grid[y][x] = 1;
  for (const k of ['allies', 'enemies', 'props', 'items', 'barriers', 'hazards', 'marks', 'rooms', 'traces', 'smoke']) g[k] = [];
  g.allySerial = 0; g.floor = 3; g.lighting = fullLighting(g.grid); g.seen = g.grid.map(r => r.map(() => true));
  Object.assign(g.player, {x: 5, y: 12, hp: 999, maxHp: 999});
  const dr = addAlly(g, 'drone', 'drone', {sourceId: 'drone_follow', point: {x: 6, y: 12}});
  const key = allyWeapon(dr).ammoType === 'rifle' ? 'reserve' : 'pistol', load0 = Math.min(allyWeapon(dr).mag, g.player[key]);
  dr.ammo = load0; g.player[key] -= load0; g.reveal();
  let dealt = 0, kills = 0, shots = 0, dry = 0, destroyed = false, playerDry = 0;
  const hit = g.hitTarget.bind(g);
  g.hitTarget = (e, dmg, attacker, ...rest) => { const hp = e.hp, r = hit(e, dmg, attacker, ...rest); if (attacker === dr) { dealt += Math.max(0, hp - Math.max(0, e.hp)); if (hp > 0 && e.hp <= 0) kills++; } return r; };
  for (let t = 1; t <= 75 && g.status === 'playing'; t++) {
    for (const w of WAVES) if (w.at === t) for (const [type, x, y] of w.foes) { if (g.enemies.some(o => o.hp > 0 && o.x === x && o.y === y) || (dr.status === 'active' && dr.x === x && dr.y === y)) continue; const e = makeEnemy(type, x, y, `w${t}-${g.enemies.length}`, 3); e.alert = true; g.enemies.push(e); }
    while (g.pendingPerks) g.choosePerk(g.perkChoices[0].id);
    g.reveal();
    const p = g.player, wpn = g.weapon, live = g.enemies.filter(e => e.hp > 0);
    const target = live.filter(e => g.visible(e) && g.shotClear(p, e) && d(e, p) <= wpn.range).sort((a, b) => d(a, p) - d(b, p))[0];
    const before = dr.ammo;
    if (target && p.ammo[p.weapon] > 0) { g.target = target.id; g.action('fire'); }
    else if (!live.length && dr.status === 'active' && dr.ammo < allyWeapon(dr).mag / 2 && g.action('usePrepared', {category: 'skill'})) g.action('usePrepared', {category: 'skill'});
    else if (p.ammo[p.weapon] < wpn.mag && p[g.reserveKey()] > 0) g.action('reload');
    else { if (live.length && !p.ammo[p.weapon]) playerDry++; g.action('wait'); }
    if (dr.status === 'active' && dr.ammo < before) shots += before - dr.ammo;
    if (dr.status === 'active' && dr.ammo === 0 && live.length) dry++;
    if (dr.status === 'destroyed') destroyed = true;
  }
  return {dealt, kills, shots, dry, destroyed, playerDry};
}

const sources = process.argv.slice(2).length ? process.argv.slice(2) : [join(dirname(fileURLToPath(import.meta.url)), '..', 'src')];
const SEEDS = Array.from({length: 30}, (_, i) => 301 + i);
console.log('| src | 無人機傷害 | 擊殺 | 開火 | 有敵人時無人機沒子彈的回合 | 被擊毀率 | 玩家沒子彈乾等的回合 |');
console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
for (const src of sources) {
  const m = await load(src), rs = SEEDS.map(s => run(m, s)), avg = f => rs.reduce((s, r) => s + f(r), 0) / rs.length;
  console.log(`| ${src} | ${avg(r => r.dealt).toFixed(0)} | ${avg(r => r.kills).toFixed(2)} | ${avg(r => r.shots).toFixed(1)} | ${avg(r => r.dry).toFixed(1)} | ${(avg(r => r.destroyed ? 1 : 0) * 100).toFixed(0)}% | ${avg(r => r.playerDry).toFixed(1)} |`);
}
