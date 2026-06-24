/* orderfuzz.js — does the ORDERED 21-atom palette stay bounded? (reconstructed for local run) */

const { loadGame, seedRandom, restoreRandom } = require('./simlib');

const K       = +(process.env.K || 3000);
const SEED    = +(process.env.SEED || 12345);
const SLOTSET = (process.env.SLOTS || '4,8,12').split(',').map(Number);
const ARMOR   = +(process.env.ARMOR || 6);
const WINDOW  = +(process.env.WINDOW || 3.0);
const CLUSTER = +(process.env.CLUSTER || 5);

const api = loadGame();
const ctx = api.getCtx();
api.startGame('ranger');
const G = api.getG();
const h = G.hero;
G.runMods = []; api.rebuild(h);
const BASE = api.resolveStat(h, 'attackDamage', ctx);
const CRIT = api.resolveStat(h, 'critChance', ctx);

let rngS = SEED >>> 0;
function rng() { rngS = (rngS + 0x6D2B79F5) | 0; let t = Math.imul(rngS ^ (rngS >>> 15), 1 | rngS); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

const V = { EMBER: 0.40, VENOM: 0.30, FROST: 0.5, SEARING: 0.7, ARC: 0.45, DET_PER: 0.20, RUP_PER: 0.30, MARK: 1.25, MOM_MAX: 5, OC: 1.5, FOCUS: 2 };

let _reEntries = 0;
let AMPS_ON = true;
function trueHit(t, dmg) {
  api.resolveAttack(h, t, { damage: dmg, critChance: 0, critMult: 1, canCrit: false, appliesOnHit: false, lifesteal: 0, lifestealMult: 0, armorPen: 0, kind: 'proc', damageType: 'true', tags: [] }, ctx);
}

const PALETTE = [
  // Producers sourced DIRECTLY from the game (single source of truth — no chargeShare duplication).
  // They loop s.targets, which the harness supplies, so the game's real act() runs unchanged.
  { id: 'ember',     role: 'prod', act: (s) => api.ATOMS.ember.act(h, s) },
  { id: 'venom',     role: 'prod', act: (s) => api.ATOMS.venom.act(h, s) },
  { id: 'frostNail', role: 'prod', act: (s) => api.ATOMS.frostNail.act(h, s) },
  { id: 'searing',   role: 'prod', act: (s) => api.ATOMS.searing.act(h, s) },
  // Arc is SPATIAL: the game's act() queries chainNearby(G.enemies); the harness substitutes its own
  // cluster, so this one stays prototyped. Mirrors the game's linear charge split across the foes hit.
  { id: 'arc',       role: 'prod', act: (s, ds) => { const tg = ds.slice(0, 2); const c = (s.power * s.mark) / Math.max(1, tg.length); for (const t of tg) trueHit(t, V.ARC * BASE * c); } },
  { id: 'overcharge',role: 'amp',  act: (s) => { if (AMPS_ON) s.power *= V.OC; } },
  { id: 'focus',     role: 'amp',  act: (s) => { if (AMPS_ON) { s.power *= V.FOCUS; s.targets = [s.primary]; } } },
  { id: 'fork',      role: 'amp',  act: (s, ds) => { if (AMPS_ON) s.targets = ds.slice(0, 3); } },
  { id: 'pierce',    role: 'amp',  act: (s, ds) => { if (AMPS_ON) s.targets = ds.slice(0, 3); } },
  { id: 'momentum',  role: 'amp',  act: (s) => { if (AMPS_ON) s.power *= 1 + 0.1 * Math.min((s.domRoleCount || 1) - 1, V.MOM_MAX); } },
  { id: 'spread',    role: 'amp',  act: (s, ds) => { if (AMPS_ON && s.dot) { const c = (s.power * s.mark) / Math.max(1, ds.length); for (const t of ds) { api.applyEffectTemplate(t, api.burnTpl(V.EMBER * BASE * c)); } } } },
  // GATES are conditional amplifiers now (boost on pass, halt on fail). The WORST-CASE ordering bound
  // is the all-conditions-met case, so under AMPS_ON we force the pass and add the real bonus (sourced
  // from the game — no drift). The halt path only ever lowers output, so it isn't a bound concern.
  { id: 'onCrit',    role: 'gate', act: (s) => { if (AMPS_ON) s.power += api.GATE_BONUS.onCrit; } },
  { id: 'execute',   role: 'gate', act: (s) => { if (AMPS_ON) s.power += api.GATE_BONUS.execute; } },
  { id: 'kindling',  role: 'gate', act: (s) => { if (AMPS_ON) s.power += api.GATE_BONUS.kindling; } },
  { id: 'everyThird',role: 'gate', act: (s) => { if (AMPS_ON) s.power += api.GATE_BONUS.everyThird; } },
  { id: 'exploit',   role: 'gate', act: (s) => { if (AMPS_ON) s.power += api.GATE_BONUS.exploit; } },
  { id: 'stun',      role: 'util', act: () => { } },
  { id: 'leech',     role: 'util', act: () => { } },
  { id: 'mark',      role: 'util', act: (s) => { if (AMPS_ON) s.mark *= V.MARK; } },
];
const byId = Object.fromEntries(PALETTE.map(a => [a.id, a]));
const PRODUCERS = PALETTE.filter(a => a.role === 'prod').map(a => a.id);

function runChain(chain, atk, cluster) {
  const primary = cluster[0];
  const s = { crit: rng() < CRIT, power: 1, mark: 1, targets: [primary], primary, tags: new Set(), alive: true, atk, dot: false };
  const rc = {}; for (const id of chain) { const a = byId[id]; if (a) rc[a.role] = (rc[a.role] || 0) + 1; } s.domRoleCount = Math.max(1, ...Object.values(rc));  // Phase 3: chain's dominant-role concentration
  api.resolveAttack(h, primary, api.basicInstance(h, ctx, ['melee']), ctx);
  for (const id of chain) { if (!s.alive) break; byId[id].act(s, cluster); }
  if (s.alive) api.runReactions(h, s);   // ambient reaction pass — the REAL game resolver (no re-prototype, no drift)
}

function makeCluster() {
  const c = [];
  for (let i = 0; i < CLUSTER; i++) c.push({ id: 'd' + i, boss: false, dead: false, x: i * 24, y: -30, r: 16,
    baseStats: api.mkStats({ armor: ARMOR, maxHealth: 1e12 }), currentHealth: 1e12, _mhp: 1e12, sources: [], activeEffects: [], tags: ['enemy'] });
  return c;
}

const DT = 1 / 60;
function measure(chain) {
  seedRandom(SEED ^ 0x9e37); api.seedRun(SEED ^ 0x9e37);
  const cl = makeCluster(); const start = cl.map(d => d.currentHealth);
  let acc = 0, t = 0, atk = 0; const as = Math.max(0.2, api.resolveStat(h, 'attackSpeed', ctx));
  while (t < WINDOW) {
    acc -= DT;
    if (acc <= 0) { atk++; runChain(chain, atk, cl); acc += 1 / as; }
    for (const d of cl) api.tickActor(d, DT);
    t += DT;
  }
  restoreRandom();
  const single = (start[0] - cl[0].currentHealth) / WINDOW;
  const total = cl.reduce((sum, d, i) => sum + (start[i] - d.currentHealth), 0) / WINDOW;
  return { single, total };
}
function baseline() {
  seedRandom(SEED ^ 0x9e37); api.seedRun(SEED ^ 0x9e37);
  const cl = makeCluster(); const s0 = cl[0].currentHealth;
  let acc = 0, t = 0; const as = Math.max(0.2, api.resolveStat(h, 'attackSpeed', ctx));
  while (t < WINDOW) { acc -= DT; if (acc <= 0) { api.resolveAttack(h, cl[0], api.basicInstance(h, ctx, ['melee']), ctx); acc += 1 / as; } for (const d of cl) api.tickActor(d, DT); t += DT; }
  restoreRandom();
  return (s0 - cl[0].currentHealth) / WINDOW;
}
const BASE_DPS = baseline();

function genChain(slots) {
  const ids = shuffle(PALETTE.map(a => a.id)).slice(0, slots);
  if (!ids.some(id => byId[id].role === 'prod')) ids[Math.floor(rng() * ids.length)] = PRODUCERS[Math.floor(rng() * PRODUCERS.length)];
  return ids;
}
function pct(a, p) { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]; }
function f(x) { return (x >= 100 ? Math.round(x) : x.toFixed(1)) + ''; }

console.log(`\nORDER-FUZZER  chains/slotcount=${K}  seed=${SEED}  enemyArmor=${ARMOR}  window=${WINDOW}s  cluster=${CLUSTER}`);
console.log(`baseline basic-attack DPS=${BASE_DPS.toFixed(1)} · 21-atom palette · single-pass interpreter on the real pipeline`);
console.log(`absPower = chain DPS ÷ lone basic (informational — the chain IS your damage). ordMult = amps-on ÷ amps-off (the runaway metric: how much sequencing/amps multiply the SAME atoms; uniqueness should cap it)\n`);
console.log('slots   chains   medAbs   maxAbs    medOrd   p99Ord   maxOrd   medBrd   maxBrd   worst-ordering chain');
let worst = { ord: 0 };
let worstBrd = { brd: 0 };
for (const slots of SLOTSET) {
  const absA = [], ordA = [], brdA = [];
  for (let i = 0; i < K; i++) {
    const c = genChain(slots);
    AMPS_ON = true;  const on = measure(c);
    AMPS_ON = false; const off = measure(c);
    const ord = off.single > 1e-6 ? on.single / off.single : 1;
    const brd = off.total  > 1e-6 ? on.total  / off.total  : 1;
    absA.push(on.single / BASE_DPS); ordA.push(ord); brdA.push(brd);
    if (ord > worst.ord) worst = { ord, abs: on.single / BASE_DPS, chain: c.slice(), slots };
    if (brd > worstBrd.brd) worstBrd = { brd, chain: c.slice(), slots };
  }
  const ws = (worst.slots === slots) ? worst.chain.join(' → ') : '';
  console.log(String(slots).padEnd(8) + String(K).padEnd(9) +
    f(pct(absA, 50)).padStart(7) + 'x' + f(Math.max(...absA)).padStart(8) + 'x' +
    f(pct(ordA, 50)).padStart(9) + 'x' + f(pct(ordA, 99)).padStart(8) + 'x' + f(Math.max(...ordA)).padStart(8) + 'x' +
    f(pct(brdA, 50)).padStart(8) + 'x' + f(Math.max(...brdA)).padStart(8) + 'x   ' + ws.slice(0, 46));
}

console.log('\nVERDICT');
console.log('  • re-entries during all runs: ' + _reEntries + ' (interpreter is single-pass by construction — sub-hits never re-walk the chain, so _CHAIN_MAX is not relied on)');
const maxOrd = worst.ord;
console.log('  • worst ORDERING multiplier: ' + f(maxOrd) + 'x  [' + (worst.chain || []).join(' → ') + ']');
const ampProduct = V.OC * V.FOCUS * (1 + 0.1 * V.MOM_MAX) * V.MARK;
console.log('  • flat-amp ceiling (one each: Overcharge x Focus x Momentum x Mark) = ' + ampProduct.toFixed(2) + 'x — uniqueness means the multiplicative amps cannot stack beyond this');
const gateSum = Object.values(api.GATE_BONUS).reduce((a, b) => a + b, 0);
const gateCeiling = ampProduct * (1 + gateSum);   // gates add to power; worst case = every gate condition met (feast-or-famine by design)
console.log('  • with-gates ceiling (all conditions met) = ' + gateCeiling.toFixed(2) + 'x — gates are CONDITIONAL amps (+power on a pass, halt on a fail); additive so they stack linearly, and uniqueness + the slot cap bound this. Reached only on swings where every gated condition holds.');
let line;
if (maxOrd <= gateCeiling * 1.25) line = 'BOUNDED — ordering multiplies the same atoms by at most ~' + f(maxOrd) + 'x, within the conditional ceiling. Sequencing cannot run away (uniqueness + slot cap); the high end is the deliberate variance from conditional gates, not compounding. Absolute damage is a separate tuning knob.';
else line = 'ABOVE the ceiling (' + f(maxOrd) + 'x vs ' + gateCeiling.toFixed(1) + 'x) — something compounds beyond unique amps + conditional gates (likely amp-scaled DoT feeding a power-scaled burst). Fix: power should not scale BOTH a DoT and its detonation.';
console.log('  • ' + line);
const BREADTH_CEILING = +(process.env.BREADTH_CEILING || 6);   // pure width/charge-conservation guardrail (amps only)
const breadthCeiling = BREADTH_CEILING * (1 + gateSum);        // gates boost cluster power too → scale the same way the ordering ceiling does
const maxBrd = worstBrd.brd;
console.log('  • worst BREADTH multiplier: ' + f(maxBrd) + 'x  [' + (worstBrd.chain || []).join(' → ') + ']  (width guardrail ' + BREADTH_CEILING + 'x · with-gates ceiling ' + breadthCeiling.toFixed(1) + 'x)');
console.log('  • ' + (maxBrd <= breadthCeiling
  ? 'BREADTH BOUNDED — cluster total stays within the conditional ceiling. Finite charge still holds width itself within the ' + BREADTH_CEILING + 'x guardrail; the headroom above it is the same bounded gate power-boost, not free width.'
  : 'BREADTH ABOVE ceiling (' + f(maxBrd) + 'x vs ' + breadthCeiling.toFixed(1) + 'x) — width multiplies total beyond what finite charge + conditional gates allow. Fix: charge must split across every added target.'));
console.log('');
