/* chainfuzz.js — how hard does a player-authored "chain" composer bite?

   Generates thousands of RANDOM valid chains under a cost budget, where a chain is the engine's
   native power-source shape { modifiers[], triggers[] } assembled from a palette of pre-tuned atoms.
   Each chain is run through the REAL pipeline (resolveStat / resolveAttack / trigger bus / tickActor)
   on a clean baseline hero, and we measure its power multiplier vs that baseline. The question:
   does a points budget keep random chains inside a bounded power band, or do certain combinations
   compound past what their cost implies (the "bite")?

   Design premise being tested: the trigger bus only heals / applies DoTs / spreads AoE — it never
   feeds a stat buff back to the hero — so triggers should add BOUNDED damage, while multiplicative
   `more`/`increased` MODIFIERS are the runaway risk. MODE lets us isolate each.

   Usage:  node test/chainfuzz.js
   Env:    MODE=all|mods|trigs   K=2000 (chains per budget)   SEED=12345   ARMOR=5   MAXPIECES=8
*/

const { loadGame, seedRandom, restoreRandom } = require('./simlib');

const MODE = process.env.MODE || 'all';
const K = +(process.env.K || 2000);
const SEED = +(process.env.SEED || 12345);
const ARMOR = +(process.env.ARMOR || 5);
const MAXPIECES = +(process.env.MAXPIECES || 8);
const BUDGETS = (process.env.BUDGETS || '6,10,14,20').split(',').map(Number);
const KILLS = +(process.env.KILLS || 3000);     // late-game context so per:kill / per:second atoms read their real magnitude
const SECS = +(process.env.SECS || 240);

const api = loadGame();
const ctx = api.getCtx();
api.startGame('ranger');
const G = api.getG();
const h = G.hero;
h.killCount = KILLS; h.combatTime = SECS;        // measure as a late-game build so unbounded scalers show their teeth
G.runMods = []; api.rebuild(h);

let rngS = SEED >>> 0;
function rng() { rngS = (rngS + 0x6D2B79F5) | 0; let t = Math.imul(rngS ^ (rngS >>> 15), 1 | rngS); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }

const DT = 1 / 60;
function dps(secs) {
  seedRandom(SEED ^ 0x5bd1); api.seedRun(SEED ^ 0x5bd1);
  const dummy = { id: 'd', boss: false, dead: false, x: h.x, y: h.y - 30, r: 16,
    baseStats: api.mkStats({ armor: Math.max(0, ARMOR), maxHealth: 1e15 }),
    currentHealth: 1e15, sources: [], activeEffects: [], tags: ['enemy'] };
  let atk = 0, t = 0; const start = dummy.currentHealth; const savedCt = h.combatTime || 0;
  while (t < secs) {
    ctx.nearbyEnemies = 3; h.combatTime = (h.combatTime || 0) + DT; atk -= DT;
    if (atk <= 0) { const as = Math.max(0.1, api.resolveStat(h, 'attackSpeed', ctx));
      api.resolveAttack(h, dummy, api.basicInstance(h, ctx, ['melee']), ctx); atk += 1 / as; }
    api.tickActor(dummy, DT); t += DT;
  }
  h.combatTime = savedCt; restoreRandom();
  return (start - dummy.currentHealth) / secs;
}
function ehp() {
  const hp = api.resolveStat(h, 'maxHealth', ctx), ar = Math.max(0, api.resolveStat(h, 'armor', ctx));
  return hp / (1 - ar / (ar + 100));
}

// baseline (no chain)
const BASE_DPS = dps(2.5), BASE_EHP = ehp();

// ---- palette of pre-tuned atoms (real engine ops/effects), each with a cost ----
const M = (stat, op, value) => ({ mod: { stat, op, value, source: 'chain' } });
const M2 = (stat, op, value, extra) => ({ mod: Object.assign({ stat, op, value, source: 'chain' }, extra) });
const T = (on, effect) => ({ trig: { on, source: 'chain', effect } });
const PALETTE = [
  // --- modifiers (the multiplicative-stacking risk) ---
  { id: 'flatDmg', kind: 'mod', cost: 1, make: () => M('attackDamage', 'flat', 6) },
  { id: 'incrDmg', kind: 'mod', cost: 2, make: () => M('attackDamage', 'increased', 0.20) },
  { id: 'moreDmg', kind: 'mod', cost: 3, make: () => M('attackDamage', 'more', 0.12) },
  { id: 'moreAtkSpd', kind: 'mod', cost: 3, make: () => M('attackSpeed', 'more', 0.10) },
  { id: 'incrAtkSpd', kind: 'mod', cost: 2, make: () => M('attackSpeed', 'increased', 0.15) },
  { id: 'flatCrit', kind: 'mod', cost: 2, make: () => M('critChance', 'flat', 0.08) },
  { id: 'moreCritMult', kind: 'mod', cost: 3, make: () => M('critMultiplier', 'more', 0.25) },
  { id: 'incrCritMult', kind: 'mod', cost: 2, make: () => M('critMultiplier', 'increased', 0.30) },
  { id: 'flatPen', kind: 'mod', cost: 2, make: () => M('armorPen', 'flat', 20) },
  { id: 'moreHP', kind: 'mod', cost: 2, make: () => M('maxHealth', 'more', 0.12) },
  { id: 'flatArmor', kind: 'mod', cost: 1, make: () => M('armor', 'flat', 15) },
  // --- bounded scalers (perMax-capped) — safe ---
  { id: 'incrDmgPerKillCap', kind: 'mod', cost: 2, make: () => M2('attackDamage', 'increased', 0.012, { per: 'kill', perMax: 50 }) },
  // --- UNBOUNDED scalers (no cap) — the known runaway vector; excluded by MODE=safe ---
  { id: 'moreDmgPerKill', kind: 'mod', cost: 3, unbounded: true, make: () => M2('attackDamage', 'more', 0.0015, { per: 'kill' }) },
  { id: 'incrDmgPerSec', kind: 'mod', cost: 3, unbounded: true, make: () => M2('attackDamage', 'increased', 0.004, { per: 'second' }) },
  // --- triggers (heal / DoT / AoE — bounded per the engine, no stat feedback) ---
  { id: 'onHitBurn', kind: 'trig', cost: 2, make: () => T('onHitDealt', { kind: 'applyEffect', to: 'other', template: api.BURN }) },
  { id: 'onHitPoison', kind: 'trig', cost: 2, make: () => T('onHitDealt', { kind: 'applyEffect', to: 'other', template: api.POISON }) },
  { id: 'onCritBurnAoE', kind: 'trig', cost: 2, make: () => T('onCrit', { kind: 'applyAoE', radius: 80, template: api.BURN }) },
  { id: 'onHitChill', kind: 'trig', cost: 1, make: () => T('onHitDealt', { kind: 'applyEffect', to: 'other', template: api.chillTpl(0.3) }) },
  { id: 'onKillHeal', kind: 'trig', cost: 1, make: () => T('onKill', { kind: 'heal', amount: { type: 'statPct', stat: 'maxHealth', pct: 0.03, of: 'self' } }) },
];
const POOL = PALETTE.filter(p => {
  if (MODE === 'trigs') return p.kind === 'trig';
  if (MODE === 'mods') return p.kind === 'mod';
  if (MODE === 'safe') return !p.unbounded;          // recommended palette: drop unbounded scalers
  return true;                                       // 'all' — includes the unbounded scalers to expose the bite
});
const UNBOUNDED_IDS = PALETTE.filter(p => p.unbounded).map(p => p.id);

function genChain(budget) {
  let b = budget; const mods = [], trigs = [], pieces = [];
  for (let i = 0; i < MAXPIECES && b > 0; i++) {
    const aff = POOL.filter(p => p.cost <= b); if (!aff.length) break;
    const p = aff[Math.floor(rng() * aff.length)]; b -= p.cost; pieces.push(p.id);
    const made = p.make(); if (made.mod) mods.push(made.mod); if (made.trig) trigs.push(made.trig);
  }
  return { modifiers: mods, triggers: trigs, _pieces: pieces, _spent: budget - b };
}
function powerOf(chain) {
  G.runMods = [{ id: 'chain', modifiers: chain.modifiers, triggers: chain.triggers }]; api.rebuild(h);
  const off = dps(2.5) / BASE_DPS, def = ehp() / BASE_EHP;
  G.runMods = []; api.rebuild(h);
  return { off, def };
}

function pct(arr, p) { const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]; }
function fmt(x) {
  if (!isFinite(x)) return '∞';
  if (x >= 1e6) return (x / 1e6).toFixed(1) + 'M';
  if (x >= 1e3) return (x / 1e3).toFixed(1) + 'k';
  if (x >= 100) return String(Math.round(x));
  return x.toFixed(1);
}

console.log(`\nCHAIN FUZZER  mode=${MODE}  chains/budget=${K}  seed=${SEED}  enemyArmor=${ARMOR}  maxPieces=${MAXPIECES}`);
console.log(`baseline ranger DPS=${BASE_DPS.toFixed(1)} EHP=${BASE_EHP.toFixed(0)} · power = chain DPS ÷ baseline DPS (offense), real pipeline\n`);
console.log('budget   chains   medOff   p90Off   p99Off   maxOff   tail(p99/med)   medDef   maxDef');

const tails = [];
let worst = { off: 0 };
for (const B of BUDGETS) {
  const offs = [], defs = [];
  for (let i = 0; i < K; i++) {
    const c = genChain(B); const { off, def } = powerOf(c);
    offs.push(off); defs.push(def);
    if (off > worst.off) worst = { off, def, budget: B, pieces: c._pieces.slice(), spent: c._spent };
  }
  const med = pct(offs, 50), p90 = pct(offs, 90), p99 = pct(offs, 99), mx = Math.max(...offs);
  const tail = med > 0 ? p99 / med : 0; tails.push({ B, med, p99, mx, tail });
  console.log(
    String(B).padEnd(9) + String(K).padEnd(9) +
    fmt(med).padStart(8) + fmt(p90).padStart(9) + fmt(p99).padStart(9) + fmt(mx).padStart(9) +
    (tail).toFixed(1).padStart(15) + 'x' + fmt(pct(defs, 50)).padStart(9) + fmt(Math.max(...defs)).padStart(9));
}

// does p99 scale linearly with budget, or super-linearly (the bite)?
const first = tails[0], last = tails[tails.length - 1];
const budgetRatio = last.B / first.B, p99Ratio = last.p99 / Math.max(1e-6, first.p99), maxRatio = last.mx / Math.max(1e-6, first.mx);

const usedUnbounded = (worst.pieces || []).filter(id => UNBOUNDED_IDS.includes(id));
console.log('\nWORST CHAIN FOUND  (offense ' + fmt(worst.off) + 'x baseline at budget ' + worst.budget + ', spent ' + worst.spent + ')');
console.log('  ' + (worst.pieces || []).join(' + '));
if (usedUnbounded.length) console.log('  ^ contains UNBOUNDED scaler(s): ' + [...new Set(usedUnbounded)].join(', ') + ' — these grow with kills/time without limit');

console.log('\nVERDICT');
console.log('  • budget x' + budgetRatio.toFixed(1) + ' (' + first.B + '->' + last.B + ') scaled p99 power x' + p99Ratio.toFixed(1) + ' and max power x' + maxRatio.toFixed(1) + ' (measured at ' + KILLS + ' kills / ' + SECS + 's)');
const superlin = p99Ratio > budgetRatio * 1.6 || maxRatio > budgetRatio * 2.5 || last.mx > 30;
if (MODE === 'trigs') console.log('  • TRIGGERS: ' + (last.mx < 6 ? 'bounded — composing trigger atoms adds damage but cannot run away (no stat feedback). Safe to expose freely.' : 'unexpectedly high — investigate proc-chain depth.'));
else if (MODE === 'safe') console.log('  • SAFE PALETTE (no unbounded scalers): ' + (superlin ? 'still fat — piece cap / budget needs tightening.' : 'BOUNDED — max ' + fmt(last.mx) + 'x. A piece cap + budget + capped scalers tames the whole space. This is a shippable palette.'));
else if (MODE === 'mods') console.log('  • MODIFIERS: ' + (superlin ? 'SUPER-LINEAR — unbounded scalers compound past cost; cap them (perMax) or ban from palette.' : 'roughly proportional to budget under the piece cap.'));
else console.log('  • COMBINED (incl. unbounded scalers): tail ' + (superlin ? 'is FAT — the unbounded scalers (per:kill/per:second) reintroduce the runaway even inside a piece cap. They must be perMax-capped or banned. Re-run MODE=safe to confirm the palette without them is bounded.' : 'stays proportional to budget.'));
console.log('  • MODE=safe excludes unbounded scalers · MODE=mods/trigs isolate atom classes · raise MAXPIECES/BUDGETS to stress the cap');
console.log('');
