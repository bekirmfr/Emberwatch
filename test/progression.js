/* progression.js — simulate a full run to wave N on the REAL game systems and report how
   hero power scales against each wave's enemies (one-shotting / balanced / falling behind).

   REAL (actual game pipeline): wave composition (startWave, seeded by wave#), enemy stats &
   scaling (spawnEnemy, diffMul=1+(wave-1)*0.11), affixes/elites, dropped gear (rollEnemyLoot),
   elite relics (rollEliteRelic), every stat & hit (resolveStat/resolveAttack/tickActor: crits,
   procs, DoTs, armor), and hero HP from leveling (fireLevel campfire passive).

   MODELED (player decisions — no real AI controller): which perk to take (greedy: the offer that
   raises DPS most, or random), whether to equip a drop (if it raises a power score), and which
   relics to take. XP is granted as the wave's full worth after each wave (you level between waves).

   HONEST CAVEAT ON THE ENGAGEMENT MODEL: hero offense is measured as sustained SINGLE-TARGET
   BASIC-ATTACK DPS (same probe autosim uses) and the wave's enemies are summed as if met at once.
   The real game has AoE/cleave/chain, abilities, kiting, i-frames, and a campfire heal between
   waves — all of which make real fights EASIER than this probe. So read ABSOLUTE survive/clear
   times as rough, and trust the RELATIVE curve: how hero-vs-enemy evolves wave to wave, where
   one-shotting begins, and whether power runs away or holds.

   Usage:  node test/progression.js
   Env:    CLASS=ranger|mage|knight  WAVES=100  SEED=12345  POLICY=greedy|random
           RELIC=all|smart|none      NIGHT=0|1
*/

const { loadGame, seedRandom, restoreRandom } = require('./simlib');

const CLASS  = process.env.CLASS  || 'ranger';
const WAVES  = +(process.env.WAVES || 100);
const SEED   = +(process.env.SEED  || 12345);
const POLICY = process.env.POLICY || 'greedy';
const RELIC  = process.env.RELIC  || 'all';     // all = take every relic; smart = only if it raises power; none = ignore
const REXCL  = process.env.REXCL  || 'none';    // exclude relics by unbounded scaling: perrelic | perkill | both | none
const GEAR   = process.env.GEAR !== '0';        // GEAR=0 disables equipping drops (isolate the gear contribution)
const PERK   = process.env.PERK !== '0';        // PERK=0 disables taking perks (still levels for fireLevel HP)
const NIGHT  = process.env.NIGHT === '1';

const api = loadGame();
const ctx = api.getCtx();
// Default the relic cap to the GAME's actual cap so `node test/progression.js` models real play.
// Pass CAP=0 to see the (impossible-in-game) uncapped runaway for comparison.
const CAP = process.env.CAP != null ? +process.env.CAP : (api.RELIC_CAP || 0);
let G;

const DT = 1 / 60;
const ENEMY_ATK_INTERVAL = 1.0;

let rngS = SEED >>> 0;
function rng() { rngS = (rngS + 0x6D2B79F5) | 0; let t = Math.imul(rngS ^ (rngS >>> 15), 1 | rngS); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }

/* ---------- real-pipeline DPS probe (mirrors autosim, shorter window) ---------- */
function dps(h, refArmor, secs) {
  seedRandom(SEED ^ 0x5bd1); api.seedRun(SEED ^ 0x5bd1);
  const dummy = { id: 'd', boss: false, dead: false, x: h.x, y: h.y - 30, r: 16,
    baseStats: api.mkStats({ armor: Math.max(0, refArmor), maxHealth: 1e15 }),
    currentHealth: 1e15, sources: [], activeEffects: [], tags: [] };
  let atkTimer = 0, elapsed = 0; const startHP = dummy.currentHealth; const savedCt = h.combatTime || 0;
  while (elapsed < secs) {
    ctx.nearbyEnemies = 3; h.combatTime = (h.combatTime || 0) + DT; atkTimer -= DT;
    if (atkTimer <= 0) { const as = Math.max(0.1, api.resolveStat(h, 'attackSpeed', ctx));
      api.resolveAttack(h, dummy, api.basicInstance(h, ctx, ['melee']), ctx); atkTimer += 1 / as; }
    api.tickActor(dummy, DT); elapsed += DT;
  }
  h.combatTime = savedCt; restoreRandom();
  return (startHP - dummy.currentHealth) / secs;
}
function ehp(h) {
  const hp = api.resolveStat(h, 'maxHealth', ctx), ar = Math.max(0, api.resolveStat(h, 'armor', ctx));
  const ev = Math.min(0.95, Math.max(0, api.resolveStat(h, 'evasion', ctx)));
  return hp / ((1 - ar / (ar + 100)) * (1 - ev));
}
function effHpOf(e) {
  const hp = api.resolveStat(e, 'maxHealth', ctx), ar = Math.max(0, api.resolveStat(e, 'armor', ctx));
  const ev = Math.min(0.95, Math.max(0, api.resolveStat(e, 'evasion', ctx)));
  return hp / ((1 - ar / (ar + 100)) * (1 - ev));
}

/* ---------- player decision policy ---------- */
function powerScore(h) {
  const ad = api.resolveStat(h, 'attackDamage', ctx), as = api.resolveStat(h, 'attackSpeed', ctx);
  const cc = Math.min(1, api.resolveStat(h, 'critChance', ctx)), cm = api.resolveStat(h, 'critMultiplier', ctx);
  const pen = api.resolveStat(h, 'armorPen', ctx) || 0;
  return ad * as * (1 + cc * (cm - 1)) * (1 + pen * 0.003) + 0.25 * Math.sqrt(ehp(h));
}
function tryEquip(h, it) {
  if (!it || it.slot == null) return false;
  const slot = it.slot, prev = h.equipment[slot], before = powerScore(h);
  h.equipment[slot] = it; api.rebuild(h);
  if (powerScore(h) >= before) return true;
  h.equipment[slot] = prev; api.rebuild(h); return false;
}
function takeRelicMaybe(h, id) {
  if (RELIC === 'none') return false;
  if (RELIC === 'all') { api.grantRunMod(id); return true; }
  const before = powerScore(h); const n0 = G.runMods.length; api.grantRunMod(id);   // smart: keep only if it helps
  if (powerScore(h) >= before) return true;
  G.runMods.length = n0; api.rebuild(h); return false;
}
// which unbounded scaling does this relic carry? per:relic (scales with relic count) / per:kill (scales with kills)
function relicScales(id) {
  const m = api.RUN_MODS.find(x => x.id === id); if (!m) return {};
  const b = m.build(); const out = {};
  for (const mod of (b.modifiers || [])) { if (mod.per === 'relic') out.relic = 1; if (mod.per === 'kill') out.kill = 1; }
  return out;
}
function relicExcluded(id) {
  if (REXCL === 'none') return false;
  const s = relicScales(id);
  if (REXCL === 'perrelic') return !!s.relic;
  if (REXCL === 'perkill') return !!s.kill;
  if (REXCL === 'both') return !!(s.relic || s.kill);
  return false;
}
function takePerk(h, waveArmor, fast) {
  const pool = api.PERKS.slice(); const offers = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const p = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    let src, heal = 0;
    if (p.tiers) { const v = p.tiers[Math.floor(rng() * p.tiers.length)]; src = p.build(v); if (p.heal) heal = v; }
    else if (p.build) src = p.build(); else if (p.src) src = p.src;
    if (src) offers.push({ src, heal });
  }
  if (!offers.length) return;
  let pick = offers[0];
  if (POLICY === 'random' || fast) pick = offers[Math.floor(rng() * offers.length)];
  else { let best = -1; for (const o of offers) { h.perks.push(o.src); api.rebuild(h); const d = dps(h, waveArmor, 1.2); h.perks.pop(); if (d > best) { best = d; pick = o; } } api.rebuild(h); }
  h.perks.push(pick.src); if (pick.heal) h.currentHealth += pick.heal; api.rebuild(h);
}

/* ---------- build one wave's REAL enemies ---------- */
function buildWave(w) {
  G.wave = w - 1; G.waveState = 'intermission'; G._tut0Pending = false; G._tut0 = false;
  G.isNight = NIGHT; G.enemies = []; G.boss = null;
  api.startWave();
  for (const q of G.spawnQueue.slice()) api.spawnEnemy(q.key, q);
  return G.enemies.slice();
}

/* ---------- run ---------- */
seedRandom(SEED); api.seedRun(SEED);
api.startGame(CLASS);
G = api.getG();
const h = G.hero;
G.runMods = G.runMods || [];
G.level = 1; G.fireLevel = 1; G.xp = 0; G.xpNext = 16; G.kills = 0; h.killCount = 0; h.combatTime = 0; G.spawnIndex = 0;
h.currentHealth = api.resolveStat(h, 'maxHealth', ctx);

const rows = [];
let firstOneShot = null, firstDanger = null, relicsTaken = 0, itemsEquipped = 0, saturated = false;

for (let w = 1; w <= WAVES; w++) {
  const enemies = buildWave(w);
  const aps = Math.max(0.1, api.resolveStat(h, 'attackSpeed', ctx));

  // group identical enemies so we resolve/probe per group, not per enemy (huge speedup at scale)
  const groups = new Map();
  for (const e of enemies) {
    const hp = api.resolveStat(e, 'maxHealth', ctx), ar = Math.max(0, api.resolveStat(e, 'armor', ctx));
    const dmg = api.resolveStat(e, 'attackDamage', ctx);
    const key = e.tag + '|' + Math.round(hp) + '|' + Math.round(ar) + '|' + (e.boss ? 1 : 0);
    const g = groups.get(key) || { tag: e.tag, hp, ar, dmg, boss: !!e.boss, eff: effHpOf(e), count: 0 };
    g.count++; groups.set(key, g);
  }
  const isBoss = [...groups.values()].some(g => g.boss);

  const probeSecs = saturated ? 0.6 : 1.5;
  const dpsByArmor = new Map();
  const heroDps = (armor) => { const k = Math.round(armor / 3) * 3; if (!dpsByArmor.has(k)) dpsByArmor.set(k, dps(h, k, probeSecs)); return dpsByArmor.get(k); };

  let totalEffHp = 0, totalInDps = 0, maxHit = 0, trashEffSum = 0, trashCount = 0, oneShots = 0, maxEnemyHp = 0, ttkW = 0;
  let repArmorW = 0;
  for (const g of groups.values()) {
    totalEffHp += g.eff * g.count; totalInDps += (g.dmg / ENEMY_ATK_INTERVAL) * g.count; maxHit = Math.max(maxHit, g.dmg);
    if (!g.boss) {
      trashEffSum += g.eff * g.count; trashCount += g.count; maxEnemyHp = Math.max(maxEnemyHp, g.hp); repArmorW += g.ar * g.count;
      const d = heroDps(g.ar), hit = d / aps; if (hit >= g.hp) oneShots += g.count; ttkW += (g.hp / Math.max(1e-6, d)) * g.count;
    }
  }
  const avgTrashEff = trashCount ? trashEffSum / trashCount : 0;
  const repArmor = trashCount ? repArmorW / trashCount : 5;
  const waveDps = heroDps(repArmor);
  const avgHit = waveDps / aps;
  const heroEhp = ehp(h);
  const oneShotFrac = trashCount ? oneShots / trashCount : 0;
  const ttkTrash = trashCount ? ttkW / trashCount : 0;
  const hitsSurvived = heroEhp / Math.max(1e-6, maxHit);
  const survT = heroEhp / Math.max(1e-6, totalInDps);
  const offPer = avgTrashEff ? waveDps / avgTrashEff : 0;   // per-typical-enemy offense: >1 kills one in <1s

  if (firstOneShot == null && oneShotFrac >= 0.5 && trashCount) firstOneShot = w;
  if (firstDanger == null && hitsSurvived < 3 && w > 3) firstDanger = w;
  if (!saturated && oneShotFrac >= 1 && offPer > 25) saturated = true;   // hero trivially wins → cheaper probes from here

  rows.push({ w, n: enemies.length, isBoss, lvl: G.level, relics: G.runMods.length, waveDps, avgHit, heroEhp, avgTrashEff, oneShotFrac, ttkTrash, hitsSurvived, survT, offPer, maxEnemyHp });

  // collect rewards for the next wave
  for (const e of enemies) {
    G.xp += e.xp || 0; G.kills++; h.killCount = (h.killCount || 0) + 1;   // per:kill (Bloodthirst) reads h.killCount
    for (const it of (api.rollEnemyLoot(e) || [])) if (GEAR && tryEquip(h, it)) itemsEquipped++;
    if (e.elite) { const rid = api.rollEliteRelic(e); if (rid && !relicExcluded(rid) && (!CAP || G.runMods.length < CAP) && takeRelicMaybe(h, rid)) relicsTaken++; }
  }
  let guard = 0;
  while (G.xp >= G.xpNext && guard++ < 60) {
    G.xp -= G.xpNext; G.level++; G.fireLevel = G.level; G.xpNext = Math.floor(16 * Math.pow(1.28, G.level - 1));
    if (PERK) takePerk(h, repArmor, saturated);
  }
  h.currentHealth = api.resolveStat(h, 'maxHealth', ctx);
}

/* ---------- report ---------- */
function fnum(x) {
  const a = Math.abs(x);
  if (a >= 1e9) return (x / 1e9).toFixed(1) + 'B';
  if (a >= 1e6) return (x / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return (x / 1e3).toFixed(1) + 'k';
  return Math.round(x).toString();
}
const padL = (s, n) => String(s).padStart(n);
const padR = (s, n) => String(s).padEnd(n);

console.log(`\nPROGRESSION  class=${CLASS}  waves=${WAVES}  seed=${SEED}  policy=${POLICY}  relic=${RELIC}  gear=${GEAR ? 'on' : 'OFF'}  perks=${PERK ? 'on' : 'OFF'}  ${NIGHT ? 'NIGHT' : 'day'}`);
console.log('enemy side = real game systems · hero side = optimizing player (basic-attack DPS; AoE/abilities not counted, so real fights are easier)\n');
console.log(padR('wave', 6) + padR('lvl', 4) + padR('rel', 5) + padR('foes', 6) + padL('heroDPS', 9) + padL('avgHit', 9) + padL('trashHP', 9) + padL('hits→kill', 10) + padL('1shot', 7) + padL('heroEHP', 9) + padL('survHits', 9) + '  note');

const tag = (r) => {
  const t = [];
  if (r.isBoss) t.push('BOSS');
  if (r.oneShotFrac >= 0.999) t.push('one-shots all trash');
  else if (r.oneShotFrac >= 0.5) t.push('one-shots most');
  if (r.hitsSurvived < 3) t.push('** fragile (<3 hits)');
  return t.join(' · ');
};
for (const r of rows) {
  if (!(r.w <= 3 || r.w % 5 === 0 || r.isBoss || r.w === firstOneShot || r.w === firstDanger || r.w === WAVES)) continue;
  const htk = r.avgHit > 0 ? (r.avgTrashEff / r.avgHit) : Infinity;
  console.log(
    padR(r.w, 6) + padR(r.lvl, 4) + padR(r.relics, 5) + padR(r.n, 6) +
    padL(fnum(r.waveDps), 9) + padL(fnum(r.avgHit), 9) + padL(fnum(r.avgTrashEff), 9) +
    padL(htk < 1 ? '<1' : fnum(htk), 10) + padL(Math.round(r.oneShotFrac * 100) + '%', 7) +
    padL(fnum(r.heroEhp), 9) + padL(r.hitsSurvived > 999 ? '999+' : r.hitsSurvived.toFixed(1), 9) + '  ' + tag(r));
}

const marks = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].filter(m => m <= WAVES);
const at = (m) => rows[m - 1] || {};
console.log('\nSCALING CURVE  (offense = heroDPS ÷ one typical trash effHP; >1 clears a foe in <1s, >>1 = one-shots)');
console.log('  wave    ' + marks.map(m => padL(m, 9)).join(''));
console.log('  offense ' + marks.map(m => padL(fnum(at(m).offPer || 0), 9)).join(''));
console.log('  survHits' + marks.map(m => { const v = at(m).hitsSurvived || 0; return padL(v > 999 ? '999+' : v.toFixed(1), 9); }).join(''));

console.log('\nVERDICT');
console.log('  • one-shots most trash from wave ' + (firstOneShot || '—') + (saturated ? ' (one-shots all trash thereafter)' : ''));
console.log('  • first fragile (survives <3 typical hits) at wave ' + (firstDanger || 'never'));
console.log('  • relics taken ' + relicsTaken + ' (final ' + G.runMods.length + ') · gear upgrades ' + itemsEquipped + ' · final level ' + G.level);
const o1 = at(1).offPer || 0, oN = at(WAVES).offPer || 0, off50 = at(50).offPer || 0;
const lateAccel = off50 > 0 ? oN / off50 : 0;   // >>1 means offense is still accelerating in the back half (runaway)
const verdict = (oN > 1000 || lateAccel > 3) ? 'hero OUTSCALES enemies — RUNAWAY (offense keeps accelerating, not just high)'
  : oN > 45 ? 'hero strongly ahead but BOUNDED (heavy/curated build; curve plateaus)'
  : oN >= 3 ? 'HEALTHY: one-shots trash, power holds steady across the run (no runaway)'
  : oN >= 1 ? 'balanced: roughly keeps pace with enemies'
  : 'enemies OUTSCALE hero — fights get grindy';
console.log('  • wave-100 offense ' + fnum(oN) + '× a typical foe · late-game acceleration (w100/w50) ' + lateAccel.toFixed(2) + 'x: ' + verdict);
if (!CAP) console.log('  • NOTE: relic cap is OFF for this run (CAP=0). The game caps relics at ' + (api.RELIC_CAP || '?') + '; the default run models that. This uncapped curve is impossible in-game.');
else if (G.runMods.length >= CAP) console.log('  • relic bag held at cap ' + CAP + ' (matches the in-game Take/Leave / swap limit).');
console.log('RAW relic=' + RELIC + ' rexcl=' + REXCL + ' cap=' + (CAP || 'none') + ' gear=' + (GEAR ? 1 : 0) + ' perk=' + (PERK ? 1 : 0) +
  ' | offPer w1=' + (at(1).offPer || 0).toPrecision(4) + ' w50=' + off50.toPrecision(4) + ' w100=' + oN.toPrecision(4) +
  ' | relics=' + G.runMods.length + ' level=' + G.level + ' firstOneShot=' + (firstOneShot || 0));
console.log('');
