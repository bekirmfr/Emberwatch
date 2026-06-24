/* composerprobe.js — ABSOLUTE balance probe for the Reactor Composer.

   orderfuzz proves the chain stays BOUNDED (relative multipliers). This probe answers the other
   question tuning needs: are the canonical fighting styles BALANCED against each other and do they
   scale sensibly vs enemies? It drives REAL chained basic attacks (basicInstance + _chain -> runChain
   -> producers at chargeShare, ambient reactions, DoT ticks via tickActor) for a set of archetype
   chains, and measures sustained single-target and cluster DPS on the real pipeline.

   Honest scope: sustained DPS is a RELATIVE yardstick (movement, uptime, abilities, i-frames ignored).
   Trust the spread between archetypes and vs the lone-basic baseline, not the absolute numbers. Gates
   that need low-HP foes (Execute) are avoided here since the dummy never dies; onCrit fires on crits.

   Usage:  node composerprobe.js [path]
   Env:    SEED=12345  WINDOW=4.0  ARMOR=6  CLUSTER=5  WARN_X=3  FAIL_X=6
*/
const { loadGame, seedRandom, restoreRandom } = require('./simlib');

const SEED = +(process.env.SEED || 12345);
const WINDOW = +(process.env.WINDOW || 4.0);
const ARMOR = +(process.env.ARMOR || 6);
const CLUSTER = +(process.env.CLUSTER || 5);
const WARN_X = +(process.env.WARN_X || 3);
const FAIL_X = +(process.env.FAIL_X || 6);
const DT = 1 / 60;

const api = loadGame(process.argv[2]);
const ctx = api.getCtx();
api.startGame('ranger');
const G = api.getG();
const h = G.hero;
G.runMods = []; api.rebuild(h);

// canonical archetypes — chosen to be measurable vs a full-HP dummy (no Execute, which needs low HP)
const BUILDS = [
  { name: 'baseline (no chain)', chain: [] },
  { name: 'Stacker',            chain: ['ember', 'venom', 'momentum'] },
  { name: 'Triple-reactor',     chain: ['ember', 'venom', 'frostNail', 'momentum'] },
  { name: 'Spreader',           chain: ['ember', 'fork', 'spread', 'arc'] },
  { name: 'Burst (onCrit)',     chain: ['searing', 'focus', 'overcharge', 'onCrit'] },
  { name: 'Concentrator',       chain: ['ember', 'overcharge', 'focus', 'momentum'] },
  { name: 'Kindling gate',      chain: ['ember', 'kindling', 'venom', 'overcharge'] },   // ember burns → kindling boosts downstream reliably
  { name: 'onCrit gate',        chain: ['onCrit', 'ember', 'venom', 'focus'] },          // gate upstream → boosts producers + reaction on crit swings
  { name: 'Cool (lean)',        chain: ['ember', 'venom'] },                             // cheap → stays cool → full power, sustainable
  { name: 'Hot (loaded)',       chain: ['ember', 'venom', 'overcharge', 'focus', 'momentum'] }, // expensive → runs hot → throttled
  { name: 'Overload',           chain: ['ember', 'venom', 'overcharge', 'focus', 'overdrive'] }, // expensive + overdrive → hot BOOSTS
];

function makeCluster(n) {
  const cl = [];
  for (let i = 0; i < n; i++) cl.push({
    id: 'd' + i, boss: false, dead: false, x: i * 20, y: 0, r: 16,    // within 90px so fork/spread/arc reach them
    baseStats: api.mkStats({ armor: ARMOR, maxHealth: 1e12 }), currentHealth: 1e12, _mhp: 1e12,
    sources: [], activeEffects: [], tags: ['enemy']
  });
  return cl;
}

function measure(chain, nTargets) {
  seedRandom(SEED ^ 0x7a1f); api.seedRun(SEED ^ 0x7a1f);   // identical crit/proc draws for every build -> fair
  const cl = makeCluster(nTargets);
  G.enemies = cl;                                          // chainNearby (fork/arc/spread) reads this
  h.chain = chain.slice();
  h.heat = 0;                                              // every build starts cool; heat then settles to its own load-driven steady state
  h.x = cl[0].x; h.y = cl[0].y - 30;
  const start = cl.map(d => d.currentHealth);
  let acc = 0, t = 0; const as = Math.max(0.2, api.resolveStat(h, 'attackSpeed', ctx));
  while (t < WINDOW) {
    acc -= DT;
    if (acc <= 0) {
      if (!cl[0].dead) { const basic = api.basicInstance(h, ctx, ['melee']); basic._chain = true; api.resolveAttack(h, cl[0], basic, ctx); }
      acc += 1 / as;
    }
    api.ventHeat(h, DT);                                   // hero upkeep isn't run here, so vent explicitly → real metabolism over the window
    for (const d of cl) api.tickActor(d, DT);
    t += DT;
  }
  restoreRandom();
  const single = (start[0] - cl[0].currentHealth) / WINDOW;
  const total = cl.reduce((s, d, i) => s + (start[i] - d.currentHealth), 0) / WINDOW;
  return { single, total, heat: api.heatFrac(h), burn: api.heatBurnFrac(h) };
}

const baseSingle = measure([], 1).single;
console.log(`\nCOMPOSER PROBE  seed=${SEED}  window=${WINDOW}s  enemyArmor=${ARMOR}  cluster=${CLUSTER}`);
console.log(`baseline lone-basic single-target DPS=${baseSingle.toFixed(1)} · real pipeline (chargeShare + ambient reactions + DoT ticks)\n`);
console.log('archetype              shape       singleDPS  xBase   clusterDPS  xBase    heat%   burn%/s');
const rows = [];
for (const b of BUILDS) {
  const s1 = measure(b.chain, 1);
  const sc = measure(b.chain, CLUSTER);
  const shape = b.chain.length ? api.chainShape(h) : '—';
  rows.push({ name: b.name, shape, single: s1.single, cluster: sc.total, heat: s1.heat, burn: s1.burn });
  console.log(
    b.name.padEnd(22) + String(shape).padEnd(11) +
    s1.single.toFixed(1).padStart(9) + (s1.single / baseSingle).toFixed(2).padStart(7) + 'x' +
    sc.total.toFixed(1).padStart(11) + (sc.total / baseSingle).toFixed(2).padStart(7) + 'x' +
    (100 * s1.heat).toFixed(0).padStart(8) + '%' + (100 * s1.burn).toFixed(1).padStart(8) + '%');
}

// --- balance verdict: spread of the BUILT archetypes (exclude baseline) ---
const built = rows.filter(r => r.shape !== '—');
const singles = built.map(r => r.single).sort((a, b) => a - b);
const med = singles[Math.floor(singles.length / 2)];
const hi = Math.max(...singles), lo = Math.min(...singles);
const topRatio = med > 0 ? hi / med : 0;
console.log('\nVERDICT');
console.log('  • archetype single-DPS spread: ' + lo.toFixed(1) + ' – ' + hi.toFixed(1) + ' (median ' + med.toFixed(1) + ')');
console.log('  • hottest archetype vs median: ' + topRatio.toFixed(2) + 'x');
let verdict;
if (topRatio >= FAIL_X) verdict = 'OUTLIER — one style is ' + topRatio.toFixed(1) + 'x the median; the first-pass numbers need re-tuning (reaction per-values / charge / atom values).';
else if (topRatio >= WARN_X) verdict = 'WIDE — spread is ' + topRatio.toFixed(1) + 'x; playable but worth nudging the hot style down.';
else verdict = 'BALANCED — archetypes sit within ' + topRatio.toFixed(1) + 'x of the median; first-pass numbers are in a healthy band.';
console.log('  • ' + verdict);
console.log('');
process.exit(topRatio >= FAIL_X ? 1 : 0);
