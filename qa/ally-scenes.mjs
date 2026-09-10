// 友軍迭代的同場景前後對照（3.36.0 起；K 開頭為 3.38 窄口卡點）。人工場景、敵人不行動，不代表自然平衡。
// 用法：node qa/ally-scenes.mjs [src 目錄]，預設為本倉庫 src，輸出 JSON。
// 比較舊版：git archive <舊 SHA> src | tar -x -C <暫存目錄>，再以 <暫存目錄>/src 執行一次。
import {pathToFileURL} from 'node:url';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const SRC = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const u = p => pathToFileURL(join(SRC, p)).href;
const {Game} = await import(u('game.js'));
const {SIZE} = await import(u('data.js'));
const {makeEnemy} = await import(u('world.js'));
const {makeBarrier} = await import(u('barriers.js'));
const {addAlly} = await import(u('allies.js'));
const {fullLighting} = await import(u('lighting.js'));

function build(character, floor = null) {
  const g = new Game(330, [], 0, character, 'onyx');
  g.grid = Array.from({length: SIZE}, () => Array(SIZE).fill(floor ? 0 : 1));
  if (floor) for (const [x0, y0, x1, y1] of floor) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g.grid[y][x] = 1;
  for (const k of ['allies', 'enemies', 'props', 'items', 'barriers', 'hazards', 'marks', 'rooms', 'traces', 'smoke']) g[k] = [];
  g.allySerial = 0; g.lighting = fullLighting(g.grid); g.seen = g.grid.map(r => r.map(() => true));
  Object.assign(g.player, {x: 10, y: 10, hp: 500, maxHp: 500}); g.start = {x: 1, y: 1}; g.end = {x: 25, y: 25};
  g.enemyAct = () => {}; g.reveal(); return g;
}
const summon = (g, x, y, type = 'rifleman') => Object.assign(addAlly(g, 'summon', type, {sourceId: 'raise_dead', point: {x, y}}), {bornTurn: 1});
const pet = (g, x, y) => Object.assign(addAlly(g, 'pet', 'crawler', {sourceId: 'pet_command', point: {x, y}}), {bornTurn: 1});
const drone = (g, x, y, src = 'drone_follow') => Object.assign(addAlly(g, 'drone', 'drone', {sourceId: src, point: {x, y}}), {bornTurn: 1, ammo: src === 'drone_sentry' ? 8 : 12});
const foe = (g, x, y) => { const e = makeEnemy('rifleman', x, y, `foe-${g.enemies.length}`); Object.assign(e, {hp: 999, maxHp: 999}); g.enemies.push(e); g.reveal(); return e; };
const d = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const turn1 = g => { g.turn = Math.max(g.turn, 2); };

// 玩家嘗試走到 goalX；被擋就等一回合再試。回報花的回合數與被擋次數。
function walk(g, dir, until, cap = 24) {
  let blocked = 0, spent = 0;
  while (!until(g) && spent < cap) {
    const t = g.turn;
    if (!g.action('move', dir)) { blocked++; g.action('wait'); }
    spent += g.turn - t;
  }
  return {reached: until(g), turns: spent, blocked};
}
const trackStuck = (g, allies, turns, act = () => g.action('wait')) => {
  const stuck = allies.map(() => 0);
  for (let i = 0; i < turns; i++) {
    const before = allies.map(a => `${a.x},${a.y}`); act();
    allies.forEach((a, j) => { if (before[j] === `${a.x},${a.y}` && d(a, g.player) > 3) stuck[j]++; });
  }
  return stuck;
};

const out = {};
const corridor = [[2, 10, 24, 10]];

// S1 一格走廊雙向相遇：友軍在玩家正前方，玩家要往前走 8 格
for (const [label, make, cls] of [['寵物', g => pet(g, 9, 10), 'druid'], ['召喚槍兵', g => summon(g, 9, 10), 'necromancer'], ['追隨無人機', g => drone(g, 9, 10), 'engineer']]) {
  const g = build(cls, corridor); g.player.x = 8; turn1(g); const a = make(g);
  out[`S1 走廊前方有${label}`] = walk(g, [1, 0], g => g.player.x >= 16);
}

// S2 兩隻召喚物在走廊互擋：召喚物排在玩家身後，玩家往前走 8 格再等 4 回合
{
  const g = build('necromancer', corridor); g.player.x = 10; turn1(g);
  const A = summon(g, 9, 10), B = summon(g, 8, 10);
  const stuck = trackStuck(g, [A, B], 8, () => g.action('move', [1, 0]));
  const stuck2 = trackStuck(g, [A, B], 4);
  out['S2 走廊兩隻召喚物'] = {前隻距離: d(A, g.player), 後隻距離: d(B, g.player), 後隻超過3格仍不動的回合: stuck[1] + stuck2[1]};
}

// S3 L 形轉角：玩家沿走廊往右再往下，寵物跟隨
{
  const g = build('druid', [[4, 10, 15, 10], [15, 10, 15, 20]]); g.player.x = 10; turn1(g); const a = pet(g, 8, 10);
  const s1 = trackStuck(g, [a], 5, () => g.action('move', [1, 0]));
  const s2 = trackStuck(g, [a], 8, () => g.action('move', [0, 1]));
  const s3 = trackStuck(g, [a], 4);
  out['S3 L 形轉角'] = {寵物最終距離: d(a, g.player), 超過3格仍不動的回合: s1[0] + s2[0] + s3[0]};
}

// S4 門前塞車：兩房間以一格門洞相連，兩隻召喚物跟玩家穿門
{
  const g = build('necromancer', [[3, 6, 9, 14], [10, 10, 10, 10], [11, 6, 18, 14]]);
  g.barriers = [makeBarrier('door', {x: 10, y: 10}, {x: 11, y: 10}, 'scene-door')];
  g.player.x = 8; g.player.y = 10; turn1(g); const A = summon(g, 7, 9), B = summon(g, 7, 11);
  walk(g, [1, 0], g => g.player.x >= 15, 16);
  let settle = 0; while (settle < 12 && [A, B].some(a => a.x < 11 || d(a, g.player) > 3)) { g.action('wait'); settle++; }
  out['S4 門洞塞車'] = {兩隻都進房且在3格內: [A, B].every(a => a.x >= 11 && d(a, g.player) <= 3), 玩家停下後再等的回合: settle, 距離: [d(A, g.player), d(B, g.player)]};
}

// S5 目的格被占：寵物的留守點被敵人占住，敵人就在寵物旁邊
{
  const g = build('druid'); turn1(g); const a = pet(g, 12, 10), e = foe(g, 13, 10); a.order = {x: 13, y: 10};
  const hp = e.hp; for (let i = 0; i < 6; i++) g.action('wait');
  out['S5 留守點被占'] = {六回合內攻擊造成傷害: hp - e.hp, 寵物位置: `${a.x},${a.y}`};
}

// S6 哨兵擋路：放置哨兵在走廊正前方（依規格不能推）
{
  const g = build('engineer', corridor); g.player.x = 8; turn1(g); drone(g, 9, 10, 'drone_sentry');
  const t = g.turn, ok = g.action('move', [1, 0]);
  out['S6 走廊前方是哨兵'] = {能通過: ok, 花回合: g.turn - t, 提示: g.logs[0]?.text};
}

// S7 超出繩索返回：寵物在 8 格外
{
  const g = build('druid'); turn1(g); const a = pet(g, 18, 10); let n = 0;
  while (d(a, g.player) > 3 && n < 12) { g.action('wait'); n++; }
  out['S7 超繩索返回'] = {回到3格內花的回合: n};
}

// E1 寵物交戰：敵人不動，離玩家 5／6 格，等 10 回合
for (const k of [5, 6]) {
  const g = build('druid'); turn1(g); const a = pet(g, 11, 10), e = foe(g, 10 + k, 10); const hp = e.hp;
  for (let i = 0; i < 10; i++) g.action('wait');
  out[`E1 寵物 vs 離玩家${k}格的敵人`] = {十回合傷害: hp - e.hp};
}

// E2 推進中交戰：玩家從敵人前 8 格往前走 4 格再停 10 回合，友軍在玩家身後
for (const [label, make, cls] of [['追隨無人機', g => drone(g, 9, 10), 'engineer'], ['召喚槍兵', g => summon(g, 9, 10), 'necromancer'], ['寵物', g => pet(g, 9, 10), 'druid']]) {
  const g = build(cls); turn1(g); const a = make(g), e = foe(g, 18, 10); const hp = e.hp; let shots = 0;
  const count = () => { shots += g.effects.filter(x => x.type === 'shot' && x.color === '#89e8c8').length; };
  for (let i = 0; i < 4; i++) { g.action('move', [1, 0]); count(); }
  for (let i = 0; i < 10; i++) { g.action('wait'); count(); }
  out[`E2 推進中交戰：${label}`] = {十四回合出手: shots, 傷害: hp - e.hp, ...(a.kind === 'drone' ? {剩彈: a.ammo} : {})};
}

// ── 3.38 窄口卡點 ──
const rooms = [[3, 6, 8, 14], [9, 10, 9, 10], [10, 6, 16, 14]];
let petDamage = 0;
const watchPet = (g, p) => { const hit = g.hitTarget.bind(g); g.hitTarget = (e, dmg, a, ...r) => { const hp = e.hp, res = hit(e, dmg, a, ...r); if (a === p) petDamage += hp - Math.max(0, e.hp); return res; }; };

// K1 死路回頭：帶兩隻召喚物走進死路走廊，再往回走 12 步
{
  const g = build('necromancer', [[3, 10, 15, 10]]); g.player.x = 6; turn1(g); summon(g, 5, 10); summon(g, 4, 10);
  for (let i = 0; i < 9; i++) g.action('move', [1, 0]);
  let ok = 0; for (let i = 0; i < 12; i++) if (g.action('move', [-1, 0])) ok++; else g.action('wait');
  out['K1 死路回頭（兩隻召喚物）'] = {十二次往回走成功: ok, 玩家最後位置: g.player.x};
}
// K2 門洞被正在射擊的友軍佔住：召喚哨兵在門洞射擊，狗在後面想衝過去
{
  const g = build('druid', rooms); Object.assign(g.player, {x: 6, y: 12}); turn1(g);
  const s = summon(g, 9, 10, 'gunner'), p = pet(g, 8, 10), e = foe(g, 13, 10); petDamage = 0; watchPet(g, p);
  const hp = e.hp; for (let i = 0; i < 8; i++) g.action('wait');
  out['K2 門洞被射擊中的友軍佔住'] = {狗造成傷害: petDamage, 總傷害: hp - e.hp, 狗位置: `${p.x},${p.y}`};
}
// K2b 同上，但換位後哨兵會失去射線（牠正在打的敵人在門洞斜上方）：不應換位
{
  const g = build('druid', rooms); Object.assign(g.player, {x: 6, y: 12}); turn1(g);
  const s = summon(g, 9, 10, 'gunner'), p = pet(g, 8, 10); foe(g, 13, 10); foe(g, 10, 8);
  for (let i = 0; i < 4; i++) g.action('wait');
  out['K2b 換位會讓射擊中的友軍失去射線'] = {哨兵位置: `${s.x},${s.y}`, 狗位置: `${p.x},${p.y}`};
}
// K3 玩家擋在走廊：狗在身後看得到前方敵人，玩家往後撞狗一次
{
  const g = build('druid', [[3, 10, 12, 10], [13, 6, 18, 14]]); Object.assign(g.player, {x: 9, y: 10}); turn1(g);
  const p = pet(g, 8, 10), e = foe(g, 15, 10); petDamage = 0; watchPet(g, p);
  g.action('move', [-1, 0]); for (let i = 0; i < 7; i++) g.action('wait');
  out['K3 玩家往後撞狗'] = {狗造成傷害: petDamage, 狗位置: `${p.x},${p.y}`};
}
// K4 走廊兩隻召喚物單純跟隨：不應為了靠近玩家而來回互換
{
  const g = build('necromancer', corridor); g.player.x = 10; turn1(g); const A = summon(g, 9, 10), B = summon(g, 8, 10);
  let swaps = 0; const log = g.log.bind(g); g.log = (t, ...r) => { if (/交換位置/.test(t)) swaps++; return log(t, ...r); };
  for (let i = 0; i < 8; i++) g.action('move', [1, 0]); for (let i = 0; i < 6; i++) g.action('wait');
  out['K4 走廊跟隨不來回互換'] = {互換次數: swaps, 前隻距離: d(A, g.player), 後隻距離: d(B, g.player)};
}

console.log(JSON.stringify(out));
