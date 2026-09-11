// 震撼彈／EMP 失能長度對照（3.42.0 起）：第 3 層空房，敵人一開始就已警戒，玩家第一個行動投擲後照常開火。
// 玩家生命設為極高，只量「清完之前受到多少傷害」與「花幾回合」。升級一律選第一個強化。人工場景，不代表自然平衡。
// 用法：node qa/grenade-control.mjs [src 目錄 ...]，預設為本倉庫 src；每個目錄輸出一張表。
// 比較舊版：git archive <舊 SHA> src | tar -x -C <暫存目錄>，再把 <暫存目錄>/src 當參數。
import {pathToFileURL, fileURLToPath} from 'node:url';
import {join, dirname} from 'node:path';

const load = async src => { const u = p => pathToFileURL(join(src, p)).href; return {...await import(u('game.js')), ...await import(u('data.js')), ...await import(u('world.js')), ...await import(u('lighting.js'))}; };
// 投擲點 (10,12) 距玩家 5 格；各組敵人都在半徑 2 內，玩家不在。
const SCENES = [
  {name: '槍兵三人', foes: [['rifleman', 10, 11], ['rifleman', 10, 13], ['rifleman', 11, 12]], keyword: 'stun'},
  {name: '破壞者＋突擊兵', foes: [['brute', 11, 12], ['raider', 10, 10], ['raider', 10, 14]], keyword: 'stun'},
  {name: '狙擊手＋槍兵', foes: [['sniper', 11, 12], ['rifleman', 10, 11], ['rifleman', 10, 13]], keyword: 'stun'},
  {name: '封鎖官（頭目級）', foes: [['warden', 11, 12]], keyword: 'emp'},
];
const d = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function run(m, seed, scene, open) {
  const {Game, SIZE, makeEnemy, fullLighting} = m;
  const g = new Game(seed, [], 0, 'soldier', 'onyx');
  g.grid = Array.from({length: SIZE}, () => Array(SIZE).fill(0));
  for (let y = 6; y <= 18; y++) for (let x = 2; x <= 22; x++) g.grid[y][x] = 1;
  for (const k of ['allies', 'enemies', 'props', 'items', 'barriers', 'hazards', 'marks', 'rooms', 'traces', 'smoke']) g[k] = [];
  g.allySerial = 0; g.floor = 3; g.lighting = fullLighting(g.grid); g.seen = g.grid.map(r => r.map(() => true));
  const p = g.player; Object.assign(p, {x: 5, y: 12, hp: 999, maxHp: 999});
  for (const [type, x, y] of scene.foes) { const e = makeEnemy(type, x, y, `f${g.enemies.length}`, 3); e.alert = true; g.enemies.push(e); }
  if (open !== 'none') { p[open === 'frag' ? 'grenades' : open] = Math.max(1, p[open === 'frag' ? 'grenades' : open] || 0); p.prepared.grenade = open; }
  g.reveal();
  let taken = 0, turns = 0;
  for (let t = 1; t <= 40 && g.status === 'playing'; t++) {
    while (g.pendingPerks) g.choosePerk(g.perkChoices[0].id);
    const live = g.enemies.filter(e => e.hp > 0); if (!live.length) break;
    const before = p.hp, wpn = g.weapon;
    if (t === 1 && open !== 'none') g.action('usePrepared', {category: 'grenade', target: {x: 10, y: 12}});
    else {
      const target = live.filter(e => g.visible(e) && g.shotClear(p, e) && d(e, p) <= wpn.range).sort((a, b) => d(a, p) - d(b, p))[0];
      if (target && p.ammo[p.weapon] > 0) { g.target = target.id; g.action('fire'); }
      else if (p.ammo[p.weapon] < wpn.mag && p[g.reserveKey()] > 0) g.action('reload');
      else g.action('wait');
    }
    taken += Math.max(0, before - p.hp); turns = t;
  }
  return {taken, turns, cleared: !g.enemies.some(e => e.hp > 0)};
}

const sources = process.argv.slice(2).length ? process.argv.slice(2) : [join(dirname(fileURLToPath(import.meta.url)), '..', 'src')];
const SEEDS = Array.from({length: 30}, (_, i) => 501 + i);
for (const src of sources) {
  const m = await load(src);
  console.log(`\n${src}\n| 場景 | 開場 | 受到傷害 | 清場回合 | 清場率 |\n| --- | --- | ---: | ---: | ---: |`);
  for (const scene of SCENES) for (const open of ['none', 'frag', scene.keyword]) {
    const rs = SEEDS.map(s => run(m, s, scene, open)), avg = f => rs.reduce((s, r) => s + f(r), 0) / rs.length;
    console.log(`| ${scene.name} | ${{none: '直接開火', frag: '破片彈', stun: '震撼彈', emp: 'EMP'}[open]} | ${avg(r => r.taken).toFixed(0)} | ${avg(r => r.turns).toFixed(1)} | ${(avg(r => r.cleared ? 1 : 0) * 100).toFixed(0)}% |`);
  }
}
