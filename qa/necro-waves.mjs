// 死靈法師三波連戰（3.40.0 起）：第 3 層空房，玩家照常開火；舊版能手動徵召就徵召（花回合），
// 新版召喚為自動、技能為免費集結，模擬中不按。玩家生命設為極高，避免提早陣亡讓後段失真。升級一律選第一個強化。
// 人工場景，不代表自然平衡。用法：node qa/necro-waves.mjs [src 目錄 ...]，預設為本倉庫 src；每個目錄輸出一列。
import {pathToFileURL, fileURLToPath} from 'node:url';
import {join, dirname} from 'node:path';

const load = async src => { const u = p => pathToFileURL(join(src, p)).href; return {...await import(u('game.js')), ...await import(u('data.js')), ...await import(u('world.js')), ...await import(u('allies.js')), ...await import(u('lighting.js')), ...await import(u('skills.js'))}; };
const WAVES = [{at: 1, foes: [['crawler', 14, 10], ['crawler', 14, 14], ['raider', 15, 12]]}, {at: 26, foes: [['rifleman', 13, 10], ['rifleman', 13, 14], ['gunner', 14, 12]]}, {at: 51, foes: [['crawler', 14, 10], ['crawler', 14, 14], ['raider', 15, 12]]}];
const d = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function run(m, seed) {
  const {Game, SIZE, makeEnemy, fullLighting, canAllySkill, SKILLS} = m, manual = SKILLS.raise_dead.cost > 0;
  const g = new Game(seed, [], 0, 'necromancer', 'onyx');
  g.grid = Array.from({length: SIZE}, () => Array(SIZE).fill(0));
  for (let y = 6; y <= 18; y++) for (let x = 2; x <= 22; x++) g.grid[y][x] = 1;
  for (const k of ['allies', 'enemies', 'props', 'items', 'barriers', 'hazards', 'marks', 'rooms', 'traces', 'smoke']) g[k] = [];
  g.allySerial = 0; g.floor = 3; g.lighting = fullLighting(g.grid); g.seen = g.grid.map(r => r.map(() => true));
  Object.assign(g.player, {x: 5, y: 12, hp: 99999, maxHp: 99999}); g.reveal();
  let dealt = 0, kills = 0, lost = 0, present = 0, fightTurns = 0, taken = 0, castTurns = 0; const dead = new Set();
  const hit = g.hitTarget.bind(g);
  g.hitTarget = (e, dmg, attacker, ...rest) => { const hp = e.hp, r = hit(e, dmg, attacker, ...rest); if (attacker?.kind === 'summon') { dealt += Math.max(0, hp - Math.max(0, e.hp)); if (hp > 0 && e.hp <= 0) kills++; } return r; };
  for (let t = 1; t <= 75 && g.status === 'playing'; t++) {
    for (const w of WAVES) if (w.at === t) for (const [type, x, y] of w.foes) { if ([...g.enemies.filter(o => o.hp > 0), ...g.allies.filter(a => a.status === 'active')].some(o => o.x === x && o.y === y)) continue; const e = makeEnemy(type, x, y, `w${t}-${g.enemies.length}`, 3); e.alert = true; g.enemies.push(e); }
    while (g.pendingPerks) g.choosePerk(g.perkChoices[0].id);
    g.reveal();
    const p = g.player, wpn = g.weapon, live = g.enemies.filter(e => e.hp > 0), hp0 = p.hp;
    const target = live.filter(e => g.visible(e) && g.shotClear(p, e) && d(e, p) <= wpn.range).sort((a, b) => d(a, p) - d(b, p))[0];
    if (manual && canAllySkill(g, 'raise_dead')) { g.action('usePrepared', {category: 'skill'}); castTurns++; }
    else if (target && p.ammo[p.weapon] > 0) { g.target = target.id; g.action('fire'); }
    else if (p.ammo[p.weapon] < wpn.mag && p[g.reserveKey()] > 0) g.action('reload');
    else g.action('wait');
    for (const a of g.allies) if (a.kind === 'summon' && a.status === 'destroyed' && !dead.has(a.id)) { dead.add(a.id); lost++; }
    if (live.length) { fightTurns++; present += g.allies.filter(a => a.kind === 'summon' && a.status === 'active').length; taken += Math.max(0, hp0 - p.hp); }
  }
  return {dealt, kills, lost, present: fightTurns ? present / fightTurns : 0, taken, castTurns};
}

const sources = process.argv.slice(2).length ? process.argv.slice(2) : [join(dirname(fileURLToPath(import.meta.url)), '..', 'src')];
const SEEDS = Array.from({length: 30}, (_, i) => 401 + i);
console.log('| src | 召喚物傷害 | 召喚物擊殺 | 召喚物陣亡 | 交戰時平均在場數 | 玩家受到的傷害 | 花在徵召的回合 |');
console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
for (const src of sources) {
  const m = await load(src), rs = SEEDS.map(s => run(m, s)), avg = f => rs.reduce((s, r) => s + f(r), 0) / rs.length;
  console.log(`| ${src} | ${avg(r => r.dealt).toFixed(0)} | ${avg(r => r.kills).toFixed(2)} | ${avg(r => r.lost).toFixed(2)} | ${avg(r => r.present).toFixed(2)} | ${avg(r => r.taken).toFixed(0)} | ${avg(r => r.castTurns).toFixed(1)} |`);
}
