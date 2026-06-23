/* dropsim.js — does the atom-acquisition model hold up under the real delivery?

   Atoms (the composer's vocabulary) arrive THREE ways:
     • SEED — a tiny producer set owned from wave 1 (the buildability floor; the dropsim stress runs showed
       2–3 producers eliminate all "dead hand" openings).
     • CARDS — the BASIC atoms (the Absorbed perk-atoms: producers, simple gates, the class signature, utility)
       appear as rare LEVEL-UP cards. Level-ups are paced by banking remains → XP, and an atom card competes in
       the offer with stat perks and Feed-the-Fire, so it is NOT every level — modeled by CARD_RATE per level-up.
     • BOSS LOOT — the rare GRAMMAR atoms (amplifiers, finishers, advanced gates) drop one per boss (~16/run).

   Slots (capacity) come from the fire track (base 3, +~1 per 2 fire levels, cap 12), modeled as a curve so we
   can compare vocabulary (atoms owned) to capacity (slots) over the run.

   Runs the REAL wave composition (startWave/spawnEnemy) for each seed's true boss schedule AND sums real enemy
   XP to drive real level-up timing. Checks the failure modes the model must avoid:
     1. DEAD HAND — owned pool can't form a valid chain (needs >=1 producer). The seed should prevent this.
     2. NO CHOICE — owned <= slots, nothing to draft (we want vocabulary to exceed capacity).
     3. EMPTY SLOTS — owned < slots, can't even fill the chain (vocabulary-starved; tolerable early, not late).

   Usage:  node test/dropsim.js
   Env:    SEEDS=200  WAVES=100  SEEDPROD=3  CARD_RATE=0.35  ATOMS_PER_BOSS=1
           SLOT_PER_BOSS=0.45  BASESLOTS=3  SLOTCAP=12  XPMUL=1
*/

const { loadGame, seedRandom } = require('/home/claude/test/simlib');

const SEEDS    = +(process.env.SEEDS || 200);
const WAVES    = +(process.env.WAVES || 100);
const SEEDPROD = +(process.env.SEEDPROD || 3);        // # producers owned at wave 1
const CARD_RATE = +(process.env.CARD_RATE || 0.35);   // per level-up: chance an atom card is offered AND taken
const APB      = +(process.env.ATOMS_PER_BOSS || 1);
const SLOT_PER_BOSS = +(process.env.SLOT_PER_BOSS || 0.45);
const BASE_SLOTS = +(process.env.BASESLOTS || 3);
const SLOT_CAP   = +(process.env.SLOTCAP || 12);
const XPMUL    = +(process.env.XPMUL || 1);

// ---- palette by acquisition channel ----
// ch: seed = owned wave 1 · card = rare level-up card (basic atoms) · boss = boss loot (rare grammar)
// role: prod = producer (a valid chain needs >=1) · amp · gate · fin · util
const PALETTE = [
  // SEED — producers, owned from wave 1 (buildability floor)
  { id: 'ember',     role: 'prod', ch: 'seed' },
  { id: 'venom',     role: 'prod', ch: 'seed' },
  { id: 'frostNail', role: 'prod', ch: 'seed' },
  // CARDS — basic atoms via level-up (Absorbed perks + class signature + utility)
  { id: 'searing',   role: 'prod', ch: 'card' },
  { id: 'arc',       role: 'prod', ch: 'card' },
  { id: 'spread',    role: 'amp',  ch: 'card' },
  { id: 'rupture',   role: 'fin',  ch: 'card' },
  { id: 'exploit',   role: 'gate', ch: 'card' },
  { id: 'stun',      role: 'gate', ch: 'card' },
  { id: 'pierce',    role: 'amp',  ch: 'card' },
  { id: 'leech',     role: 'util', ch: 'card' },
  { id: 'mark',      role: 'util', ch: 'card' },
  // BOSS LOOT — the rare grammar (amplifiers, finisher, advanced gates)
  { id: 'overcharge',role: 'amp',  ch: 'boss' },
  { id: 'focus',     role: 'amp',  ch: 'boss' },
  { id: 'fork',      role: 'amp',  ch: 'boss' },
  { id: 'momentum',  role: 'amp',  ch: 'boss' },
  { id: 'detonate',  role: 'fin',  ch: 'boss' },
  { id: 'onCrit',    role: 'gate', ch: 'boss' },
  { id: 'execute',   role: 'gate', ch: 'boss' },
  { id: 'kindling',  role: 'gate', ch: 'boss' },
  { id: 'everyThird',role: 'gate', ch: 'boss' },
];
const byId = Object.fromEntries(PALETTE.map(a => [a.id, a]));
const SEED_SET  = PALETTE.filter(a => a.ch === 'seed').slice(0, SEEDPROD).map(a => a.id);
const CARD_POOL = PALETTE.filter(a => a.ch === 'card').map(a => a.id);
const BOSS_POOL = PALETTE.filter(a => a.ch === 'boss').map(a => a.id);

const buildable = (o) => o.some(id => byId[id].role === 'prod');                 // >=1 producer => valid chain exists
function rich(o) {
  if (!buildable(o)) return false;
  const amp = o.some(id => byId[id].role === 'amp'), fin = o.some(id => byId[id].role === 'fin');
  const dot = o.some(id => ['ember', 'venom'].includes(id));
  return amp || (fin && dot);
}

let rs = 0;
function rng() { rs = (rs + 0x6D2B79F5) | 0; let t = Math.imul(rs ^ (rs >>> 15), 1 | rs); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function draw(ownedSet, pool) { const a = pool.filter(id => !ownedSet.has(id)); if (!a.length) return; ownedSet.add(a[Math.floor(rng() * a.length)]); }

const api = loadGame();
// ---- one seed: real waves (bosses + XP-driven level-ups) drive card+boss acquisition ----
function runSeed(seed) {
  rs = (seed * 2654435761) >>> 0;
  seedRandom(seed); api.seedRun(seed); api.startGame('ranger');
  const G = api.getG();
  G.level = 1; G.xp = 0; G.xpNext = 16;
  const owned = new Set(SEED_SET);
  const checkpoints = []; let bossIdx = 0;
  for (let w = 1; w <= WAVES; w++) {
    G.wave = w - 1; G.waveState = 'intermission'; G._tut0 = false; G.isNight = false; G.enemies = []; G.boss = null;
    api.startWave();
    for (const q of G.spawnQueue.slice()) api.spawnEnemy(q.key, q);
    let boss = 0, xp = 0;
    for (const e of G.enemies) { if (e.boss) boss++; xp += (e.xp || 0); }
    // real level-ups this wave (XP from banked remains)
    G.xp += xp * XPMUL; let levelUps = 0, guard = 0;
    while (G.xp >= G.xpNext && guard++ < 80) { G.xp -= G.xpNext; G.level++; G.xpNext = Math.floor(16 * Math.pow(1.28, G.level - 1)); levelUps++; }
    for (let i = 0; i < levelUps; i++) if (rng() < CARD_RATE) draw(owned, CARD_POOL);   // basic atoms as rare cards
    for (let b = 0; b < boss; b++) { bossIdx++; for (let a = 0; a < APB; a++) draw(owned, BOSS_POOL); }   // grammar from bosses
    if (boss) {
      const slots = Math.min(SLOT_CAP, BASE_SLOTS + Math.floor(bossIdx * SLOT_PER_BOSS));
      const o = [...owned];
      checkpoints.push({ w, bossIdx, owned: o.length, slots, buildable: buildable(o), rich: rich(o),
        surplus: o.length - slots, empty: Math.max(0, slots - o.length),
        cov: ['prod', 'amp', 'gate', 'fin'].every(r => o.some(id => byId[id].role === r)) });
    }
  }
  return checkpoints;
}

const marks = [1, 3, 5, 8, 12, 16];
const acc = Object.fromEntries(marks.map(m => [m, { wave: 0, owned: 0, slots: 0, buildable: 0, rich: 0, surplus: 0, empty: 0, cov: 0, n: 0 }]));
let deadHands = 0, totalCk = 0, noChoice = 0, emptySlots = 0, finalOwned = 0, finalSeeds = 0, maxBoss = 0;
for (let s = 0; s < SEEDS; s++) {
  const cks = runSeed(1000 + s * 7);
  maxBoss = Math.max(maxBoss, cks.length);
  for (const c of cks) {
    totalCk++; if (!c.buildable) deadHands++; if (c.surplus <= 0) noChoice++; if (c.empty > 0) emptySlots++;
    if (acc[c.bossIdx]) { const a = acc[c.bossIdx]; a.wave += c.w; a.owned += c.owned; a.slots += c.slots; a.buildable += c.buildable ? 1 : 0; a.rich += c.rich ? 1 : 0; a.surplus += c.surplus; a.empty += c.empty; a.cov += c.cov ? 1 : 0; a.n++; }
  }
  if (cks.length) { finalOwned += cks[cks.length - 1].owned; finalSeeds++; }
}

console.log(`\nDROP-SIM  seeds=${SEEDS}  waves=${WAVES}  seedProducers=${SEEDPROD}  cardRate=${CARD_RATE}/levelup  atoms/boss=${APB}`);
console.log(`channels: SEED ${SEED_SET.length} (wave 1) · CARDS ${CARD_POOL.length} (level-up) · BOSS ${BOSS_POOL.length} (loot) · slots base ${BASE_SLOTS} +${SLOT_PER_BOSS}/boss cap ${SLOT_CAP}\n`);
const pad = (s, n) => String(s).padStart(n);
console.log('boss#  atWave  owned  slots  surplus  emptySlots  buildable%  rich%  4-role-cov%');
for (const m of marks) {
  const a = acc[m]; if (!a.n) continue;
  console.log(pad(m, 5) + pad(Math.round(a.wave / a.n), 8) + pad((a.owned / a.n).toFixed(1), 7) + pad((a.slots / a.n).toFixed(1), 7) +
    pad((a.surplus / a.n).toFixed(1), 9) + pad((a.empty / a.n).toFixed(2), 12) + pad((100 * a.buildable / a.n).toFixed(0) + '%', 12) +
    pad((100 * a.rich / a.n).toFixed(0) + '%', 7) + pad((100 * a.cov / a.n).toFixed(0) + '%', 13));
}
console.log('\nVERDICT');
console.log('  • DEAD HANDS (no valid chain assemblable): ' + deadHands + ' / ' + totalCk + ' (' + (100 * deadHands / totalCk).toFixed(1) + '%)');
console.log('  • EMPTY SLOTS (owned < slots — vocabulary cannot fill capacity): ' + emptySlots + ' / ' + totalCk + ' (' + (100 * emptySlots / totalCk).toFixed(1) + '%)');
console.log('  • NO DRAFT CHOICE (owned <= slots): ' + noChoice + ' / ' + totalCk + ' (' + (100 * noChoice / totalCk).toFixed(1) + '%)');
console.log('  • avg atoms owned by run end: ' + (finalOwned / Math.max(1, finalSeeds)).toFixed(1) + ' of ' + PALETTE.length + ' · max bosses reached: ' + maxBoss);
const dh = deadHands / Math.max(1, totalCk), es = emptySlots / Math.max(1, totalCk);
console.log('  • ' + (dh === 0 ? 'NO dead hands — the seed guarantees a valid chain from wave 1' : (dh * 100).toFixed(1) + '% DEAD HANDS — raise SEEDPROD'));
console.log('  • ' + (es < 0.10 ? 'slots fill almost always — card+boss pace keeps up with capacity' : (es * 100).toFixed(0) + '% of checkpoints had empty slots (early vocabulary thin) — raise CARD_RATE or SEEDPROD'));
console.log('  • tune CARD_RATE to set how fast basic atoms arrive via level-up · SEEDPROD for the wave-1 floor');
console.log('');
