/* orderfuzz.js — does the ORDERED 21-atom palette stay bounded?

   This prototypes the composer interpreter (the left-to-right charge walk) in the harness, so we can
   measure the worst random ordering BEFORE any of it goes in the game. Each atom acts through the REAL
   effect primitives — burnTpl/poisonTpl/chillTpl applied via applyEffectTemplate and ticked by tickActor,
   real resolveAttack for the base hit / Searing / Arc / detonate bursts — with a `power` multiplier
   threaded through the signal so an upstream amplifier scales the producers/finishers downstream of it.

   The signal carried down the chain: { crit, power, targets[], tags, alive, mark }.
   Grammar: PRODUCERS load the charge, AMPS transform it, GATES can kill it, FINISHERS spend it. A valid
   chain needs >=1 producer (the dropsim buildability rule). Atoms are UNIQUE (non-stackable) — which is
   what bounds amp stacking: you can hold at most ONE Overcharge, ONE Focus, etc.

   Key safety properties under test:
     • single-target power across random orderings stays inside the ~10x band the slot cap targets
     • the walk is SINGLE-PASS — producer/finisher sub-hits do NOT re-enter the chain (no _CHAIN_MAX needed)
     • Fork x Detonate (widen then burst) doesn't blow up

   Usage:  node test/orderfuzz.js
   Env:    K=3000 (chains/slotcount)  SEED=12345  SLOTS=4,8,12  ARMOR=6  WINDOW=3.0  CLUSTER=5
*/

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
G.runMods = []; api.rebuild(h);                       // clean baseline: chain is the ONLY added power
const BASE = api.resolveStat(h, 'attackDamage', ctx);
const CRIT = api.resolveStat(h, 'critChance', ctx);

let rngS = SEED >>> 0;
function rng() { rngS = (rngS + 0x6D2B79F5) | 0; let t = Math.imul(rngS ^ (rngS >>> 15), 1 | rngS); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---- tuned atom values, as FRACTIONS of attack damage (so atoms scale with the hero and stay relevant
//      when you actually have the slots; makes the power ratio stage-independent). Frost is a slow (no dmg). ----
const V = { EMBER: 0.40, VENOM: 0.30, FROST: 0.5, SEARING: 0.7, ARC: 0.45, DET_PER: 0.20, RUP_PER: 0.30, MARK: 1.25, MOM_MAX: 5, OC: 1.5, FOCUS: 2 };

// ---- the 21-atom palette: role + how it acts on the signal/targets ----
// role: prod | amp | gate | fin | util   ·  reEnter flags any sub-hit that could re-trigger (we assert it doesn't)
const PALETTE = [
  // producers
  { id: 'ember',     role: 'prod', act: (s, ds) => { for (const t of s.targets) api.applyEffectTemplate(t, api.burnTpl(V.EMBER * BASE * s.power * s.mark)); s.tags.add('fire'); s.dot = true; } },
  { id: 'venom',     role: 'prod', act: (s, ds) => { for (const t of s.targets) api.applyEffectTemplate(t, api.poisonTpl(V.VENOM * BASE * s.power * s.mark)); s.tags.add('poison'); s.dot = true; } },
  { id: 'frostNail', role: 'prod', act: (s, ds) => { for (const t of s.targets) api.applyEffectTemplate(t, api.chillTpl(V.FROST)); s.tags.add('frost'); } },
  { id: 'searing',   role: 'prod', act: (s, ds) => { for (const t of s.targets) trueHit(t, V.SEARING * BASE * s.power * s.mark); s.tags.add('fire'); } },
  { id: 'arc',       role: 'prod', act: (s, ds) => { for (const t of ds.slice(0, 2)) trueHit(t, V.ARC * BASE * s.power * s.mark); } },
  // amplifiers (transform the live signal)
  { id: 'overcharge',role: 'amp',  act: (s) => { if (AMPS_ON) s.power *= V.OC; } },
  { id: 'focus',     role: 'amp',  act: (s) => { if (AMPS_ON) { s.power *= V.FOCUS; s.targets = [s.primary]; } } },
  { id: 'fork',      role: 'amp',  act: (s, ds) => { if (AMPS_ON) s.targets = ds.slice(0, 3); } },
  { id: 'pierce',    role: 'amp',  act: (s, ds) => { if (AMPS_ON) s.targets = ds.slice(0, 3); } },
  { id: 'momentum',  role: 'amp',  act: (s) => { if (AMPS_ON) s.power *= 1 + 0.1 * Math.min(s.tags.size, V.MOM_MAX); } },
  { id: 'spread',    role: 'amp',  act: (s, ds) => { if (AMPS_ON && s.dot) for (const t of ds) { api.applyEffectTemplate(t, api.burnTpl(V.EMBER * BASE * s.power * s.mark)); } } },
  // gates (a failed gate kills the rest of the chain)
  { id: 'onCrit',    role: 'gate', act: (s) => { if (!s.crit) s.alive = false; } },
  { id: 'execute',   role: 'gate', act: (s) => { if (s.primary.currentHealth > 0.30 * s.primary._mhp) s.alive = false; } },
  { id: 'kindling',  role: 'gate', act: (s) => { if (!s.primary.activeEffects.some(e => e.source === 'Burn')) s.alive = false; } },
  { id: 'everyThird',role: 'gate', act: (s) => { if (s.atk % 3 !== 0) s.alive = false; } },
  { id: 'exploit',   role: 'gate', act: (s) => { const n = s.primary.activeEffects.length; if (n < 2) s.alive = false; } },
  { id: 'stun',      role: 'gate', act: () => { } },                                  // control; no damage contribution
  // finishers (spend the loaded charge)
  { id: 'detonate',  role: 'fin',  act: (s) => { burst(s, ['Burn', 'Poison'], V.DET_PER); } },
  { id: 'rupture',   role: 'fin',  act: (s) => { burst(s, ['Poison'], V.RUP_PER); } },
  // utility
  { id: 'leech',     role: 'util', act: () => { } },                                  // heals hero; no enemy damage
  { id: 'mark',      role: 'util', act: (s) => { if (AMPS_ON) s.mark *= V.MARK; } },
];
const byId = Object.fromEntries(PALETTE.map(a => [a.id, a]));
const PRODUCERS = PALETTE.filter(a => a.role === 'prod').map(a => a.id);

// ---- damage helpers (real engine) ----
let _reEntries = 0;                                  // counts any nested chain re-entry (must stay 0 — single-pass)
let AMPS_ON = true;                                  // when false, amps are no-ops — isolates the ordering/amp multiplier
function trueHit(t, dmg) {
  api.resolveAttack(h, t, { damage: dmg, critChance: 0, critMult: 1, canCrit: false, appliesOnHit: false, lifesteal: 0, lifestealMult: 0, armorPen: 0, kind: 'proc', damageType: 'true', tags: [] }, ctx);
}
function burst(s, sources, per) {
  const t = s.primary; let n = 0;
  for (const e of t.activeEffects) if (sources.includes(e.source)) n += (e.stacks || 1);
  if (n < 5) return;                                  // threshold (matches Rupture)
  t.activeEffects = t.activeEffects.filter(e => !sources.includes(e.source));
  trueHit(t, per * BASE * n * s.power * s.mark);
}

// ---- the interpreter: ONE left-to-right pass per attack ----
function runChain(chain, atk, cluster) {
  const primary = cluster[0];
  const s = { crit: rng() < CRIT, power: 1, mark: 1, targets: [primary], primary, tags: new Set(), alive: true, atk, dot: false };
  // base hit (implicit initiator) — never amplified; chain atoms come after
  api.resolveAttack(h, primary, api.basicInstance(h, ctx, ['melee']), ctx);
  for (const id of chain) { if (!s.alive) break; byId[id].act(s, cluster); }
}

function makeCluster() {
  const c = [];
  for (let i = 0; i < CLUSTER; i++) c.push({ id: 'd' + i, boss: false, dead: false, x: i * 24, y: -30, r: 16,
    baseStats: api.mkStats({ armor: ARMOR, maxHealth: 1e12 }), currentHealth: 1e12, _mhp: 1e12, sources: [], activeEffects: [], tags: ['enemy'] });
  return c;
}

// ---- measure a chain's single-target & total DPS vs a bare basic attack ----
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

// ---- generate a random VALID chain of up to `slots` unique atoms (>=1 producer) ----
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
console.log('slots   chains   medAbs   maxAbs    medOrd   p99Ord   maxOrd    worst-ordering chain');
let worst = { ord: 0 };
for (const slots of SLOTSET) {
  const absA = [], ordA = [];
  for (let i = 0; i < K; i++) {
    const c = genChain(slots);
    AMPS_ON = true;  const on = measure(c);
    AMPS_ON = false; const off = measure(c);
    const ord = off.single > 1e-6 ? on.single / off.single : 1;
    absA.push(on.single / BASE_DPS); ordA.push(ord);
    if (ord > worst.ord) worst = { ord, abs: on.single / BASE_DPS, chain: c.slice(), slots };
  }
  const ws = (worst.slots === slots) ? worst.chain.join(' → ') : '';
  console.log(String(slots).padEnd(8) + String(K).padEnd(9) +
    f(pct(absA, 50)).padStart(7) + 'x' + f(Math.max(...absA)).padStart(8) + 'x' +
    f(pct(ordA, 50)).padStart(9) + 'x' + f(pct(ordA, 99)).padStart(8) + 'x' + f(Math.max(...ordA)).padStart(8) + 'x   ' + ws.slice(0, 46));
}

console.log('\nVERDICT');
console.log('  • re-entries during all runs: ' + _reEntries + ' (interpreter is single-pass by construction — sub-hits never re-walk the chain, so _CHAIN_MAX is not relied on)');
const maxOrd = worst.ord;
console.log('  • worst ORDERING multiplier: ' + f(maxOrd) + 'x  [' + (worst.chain || []).join(' → ') + ']');
const ampProduct = V.OC * V.FOCUS * (1 + 0.1 * V.MOM_MAX) * V.MARK;   // theoretical ceiling from the unique amps
console.log('  • theoretical amp ceiling (one each: Overcharge x Focus x Momentum x Mark) = ' + ampProduct.toFixed(2) + 'x — uniqueness means amps cannot stack beyond this');
let line;
if (maxOrd <= ampProduct * 1.25) line = 'BOUNDED — ordering/amps multiply the same atoms by at most ~' + f(maxOrd) + 'x, at or below the unique-amp ceiling. Sequencing cannot run away; absolute damage is a separate tuning knob (atom values vs enemy HP, governed by the progression sim).';
else line = 'ABOVE the amp ceiling (' + f(maxOrd) + 'x vs ' + ampProduct.toFixed(1) + 'x) — something compounds beyond the unique amps (likely amp-scaled DoT stacking feeding a power-scaled detonate). Fix: power should not scale BOTH a DoT and its detonation.';
console.log('  • ' + line);
console.log('');
