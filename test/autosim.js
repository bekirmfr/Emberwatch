/* autosim.js — Phase 1.5 balance probe.
   Drives the REAL combat pipeline (resolveAttack + basicInstance + tickActor + the
   trigger bus) against a training dummy to measure sustained single-target DPS, and
   estimates EHP from resolveStat. Runs a battery of archetype + random loadouts and
   flags outliers, so Phase 2 content (multiplicative items, thresholds, transforms)
   gets balance-checked instead of eyeballed.

   Honest scope: DPS is REAL (every crit/proc/DoT/scaling/guard participates). It is a
   sustained single-target yardstick for RELATIVE comparison, not an absolute in-game
   number — it ignores movement/uptime/AoE and does NOT credit on-kill or per:kill
   effects (the dummy never dies). EHP is a STATIC estimate (armor+evasion only; no
   regen/lifesteal/counter). Both are tuned to catch "this build is 5x everyone else",
   which is exactly the degenerate-strategy signal we need.

   Run: node test/autosim.js
   Exit 1 if any loadout exceeds the hard DPS ceiling (default 6x median). */
const { loadGame, seedRandom, restoreRandom } = require('./simlib');

const GEAR_SEED = 12345;     // reproducible loadout rolls
const PROBE_SEED = 99;       // identical combat RNG for every probe -> fair comparison
const SECONDS = 6, DT = 1 / 60;
const WARN_X = 3, FAIL_X = 6; // multiples of median DPS

const api = loadGame();
const ctx = api.getCtx();

/* ---- loadout construction (all real: real perks, real rolled gear) ---- */
function perkSource(nm, tier) {
  const p = api.PERKS.find(x => x.nm === nm);
  if (!p) throw new Error("unknown perk " + nm);
  if (p.build) return p.build(tier != null ? tier : (p.tiers ? p.tiers[p.tiers.length - 1] : 1));
  return p.src; // binary perks (e.g. Hurricane)
}
function rolledItems(n, filter, maxTries = 4000) {
  const out = [];
  for (let i = 0; i < maxTries && out.length < n; i++) {
    const it = api.rollItem(20, 2);
    if (!filter || filter(it)) out.push(it);
  }
  return out;
}
const hasStat = s => it => it.modifiers && it.modifiers.some(m => m.stat === s);
const hasTag = tg => it => it.tags && it.tags.includes(tg);

/* Build a fully-formed hero with the loadout applied through the real source model. */
function buildHero(cls, perks, items) {
  api.startGame(cls);
  const h = api.getG().hero;
  h.perks = (perks || []).map(p => perkSource(p.nm, p.tier));
  api.rebuild(h);                              // classPassive + fire + perks + equipment + set bonuses + census
  for (const it of (items || [])) h.sources.push(it);
  const tc = {};                               // recompute census including fabricated item sources
  for (const src of h.sources) for (const tag of (src.tags || [])) tc[tag] = (tc[tag] || 0) + 1;
  h.tagCount = tc;
  h.combatTime = 0; h.killCount = 0;
  h.currentHealth = api.resolveStat(h, "maxHealth", ctx);
  return h;
}

/* ---- the real-pipeline DPS probe ---- */
function dpsProbe(h, { refArmor = 10, refEnemies = 1 } = {}) {
  seedRandom(PROBE_SEED);                       // cosmetic stream (any stray Math.random in damage paths)
  api.seedRun(PROBE_SEED);                       // gameplay stream — identical crit/proc draws for every loadout
  const dummy = {
    id: "dummy", boss: false, dead: false, x: h.x, y: h.y - 30, r: 16,
    baseStats: api.mkStats({ armor: refArmor, maxHealth: 1e12 }),
    currentHealth: 1e12, sources: [], activeEffects: [], tags: []
  };
  const startHP = dummy.currentHealth;
  let atkTimer = 0, elapsed = 0;
  while (elapsed < SECONDS) {
    ctx.nearbyEnemies = refEnemies;             // per:enemyNearby scaling sees the reference crowd
    h.combatTime += DT;                         // per:second scaling advances
    atkTimer -= DT;
    if (atkTimer <= 0) {
      const as = Math.max(0.1, api.resolveStat(h, "attackSpeed", ctx));
      api.resolveAttack(h, dummy, api.basicInstance(h, ctx, ["melee"]), ctx);  // real hit: crits, on-hit procs, DoT application
      atkTimer += 1 / as;
    }
    api.tickActor(dummy, DT);                   // real DoT drain + effect expiry
    elapsed += DT;
  }
  restoreRandom();
  return (startHP - dummy.currentHealth) / SECONDS;
}

/* ---- static EHP estimate (defensive outlier detector) ---- */
function ehpEstimate(h) {
  const hp = api.resolveStat(h, "maxHealth", ctx);
  const armor = Math.max(0, api.resolveStat(h, "armor", ctx));
  const eva = Math.min(0.95, Math.max(0, api.resolveStat(h, "evasion", ctx)));
  const mit = 1 - armor / (armor + 100);
  return hp / (mit * (1 - eva));
}

/* ---- battery ---- */
seedRandom(GEAR_SEED); api.seedRun(GEAR_SEED);   // reproducible gear rolls (rollItem now draws from the gameplay stream)
const loadouts = [
  { name: "baseline (vanilla ranger)", cls: "ranger", perks: [], items: [] },
  { name: "AD stack", cls: "ranger", perks: [{ nm: "Sharpened Edge" }], items: rolledItems(4, hasStat("attackDamage")) },
  { name: "attack-speed stack", cls: "ranger", perks: [{ nm: "Rapid Loosing" }], items: rolledItems(4, hasStat("attackSpeed")) },
  { name: "crit stack", cls: "ranger", perks: [{ nm: "Deadeye" }, { nm: "Executioner" }], items: rolledItems(4, hasStat("critChance")) },
  { name: "fire STACK (Pyromancer + fire gear)", cls: "ranger", perks: [{ nm: "Pyromancer" }], items: rolledItems(5, hasTag("fire")) },
  { name: "frenzy (more-mult, low HP)", cls: "ranger", perks: [{ nm: "Frenzy" }, { nm: "Sharpened Edge" }], items: rolledItems(3, hasStat("attackDamage")) },
  { name: "tank (EHP)", cls: "knight", perks: [{ nm: "Ironhide" }], items: rolledItems(4, hasStat("armor")) },
  // (fire/poison/detonate/wildfire/opportunist builds ABSORBED into the composer — profiled by test/orderfuzz.js)
  { name: "armor-pen (AD + pen gear)", cls: "ranger", perks: [{ nm: "Sharpened Edge" }], items: rolledItems(4, hasStat("armorPen")) },
];
for (let i = 0; i < 24; i++) {
  loadouts.push({ name: "random #" + (i + 1), cls: "ranger", perks: [], items: rolledItems(4) });
}

/* ---- run + report ---- */
const rows = loadouts.map(L => {
  const h = buildHero(L.cls, L.perks, L.items);
  return { name: L.name, dps: dpsProbe(h), ehp: ehpEstimate(h) };
});
restoreRandom();

const dpsSorted = rows.map(r => r.dps).slice().sort((a, b) => a - b);
const median = dpsSorted[Math.floor(dpsSorted.length / 2)] || 1;
const ehpSorted = rows.map(r => r.ehp).slice().sort((a, b) => a - b);
const ehpMed = ehpSorted[Math.floor(ehpSorted.length / 2)] || 1;

rows.sort((a, b) => b.dps - a.dps);
const pad = (s, n) => (s + " ".repeat(n)).slice(0, n);
console.log("=== Emberwatch auto-sim (Phase 1.5) ===");
console.log("DPS median " + median.toFixed(1) + "  |  EHP median " + Math.round(ehpMed) + "  |  " + SECONDS + "s probe, refArmor=10\n");
console.log(pad("loadout", 44) + pad("DPS", 10) + pad("xMed", 8) + pad("EHP", 12) + "flags");
let fails = 0, warns = 0;
for (const r of rows) {
  const x = r.dps / median, ex = r.ehp / ehpMed;
  let flag = "";
  if (x >= FAIL_X) { flag = "*** DPS OUTLIER (FAIL)"; fails++; }
  else if (x >= WARN_X) { flag = "!! dps high (warn)"; warns++; }
  if (ex >= FAIL_X) { flag += (flag ? " | " : "") + "*** EHP OUTLIER"; warns++; }
  console.log(pad(r.name, 44) + pad(r.dps.toFixed(1), 10) + pad("x" + x.toFixed(2), 8) + pad(Math.round(r.ehp).toString(), 12) + flag);
}
console.log("\n" + (fails ? ("FAIL: " + fails + " loadout(s) exceed " + FAIL_X + "x median DPS") :
  (warns ? ("OK with " + warns + " warning(s) (>= " + WARN_X + "x median)") : "OK: no outliers beyond " + WARN_X + "x median")));

/* ---- PHASE 4: elite-affix balance audit ----------------------------------
   Affixes are stat sources; an "elite" must be a fair bump, not a wall. For each
   enemy type × each affix we resolve the elite's effective HP (maxHealth folded
   through armor mitigation) and attackDamage, and compare to the vanilla of the
   same type. Bands catch a future affix that inflates an enemy absurdly. On-hit
   affixes carry no stat modifiers (they apply DoTs to the hero) → ratio 1.0. */
const EHP_WARN = 3.0, EHP_FAIL = 4.5, DMG_WARN = 1.8, DMG_FAIL = 2.2;
function enemyEffHp(e) {
  const hp = api.resolveStat(e, "maxHealth", ctx);
  const armor = Math.max(0, api.resolveStat(e, "armor", ctx));
  const eva = Math.min(0.95, Math.max(0, api.resolveStat(e, "evasion", ctx)));
  return hp / ((1 - armor / (armor + 100)) * (1 - eva));
}
function mkEnemy(type, affix) {
  const a = api.ENEMIES[type];
  const e = { tag: a.tag, baseStats: api.mkStats(Object.assign({}, a.stats, { critMultiplier: 1.5 })), sources: [{ id: "arch", modifiers: [], triggers: [] }], activeEffects: [] };
  if (affix) { const src = affix.build(); src.id = "affix_" + affix.id; e.sources.push(src); }
  return e;
}
console.log("\n=== elite-affix audit (effective-HP / damage vs vanilla) ===");
console.log(pad("enemy + affix", 30) + pad("effHP x", 12) + pad("dmg x", 10) + "flags");
let eliteFails = 0, eliteWarns = 0;
const TYPES = Object.keys(api.ENEMIES).filter(t => t !== "boss");
for (const type of TYPES) {
  const vh = enemyEffHp(mkEnemy(type)), vd = api.resolveStat(mkEnemy(type), "attackDamage", ctx);
  for (const af of api.ENEMY_AFFIXES) {
    const e = mkEnemy(type, af);
    const eh = enemyEffHp(e) / (vh || 1), ed = api.resolveStat(e, "attackDamage", ctx) / (vd || 1);
    const stat = (af.build().modifiers.length === 0);
    let flag = "";
    if (eh >= EHP_FAIL) { flag = "*** effHP FAIL"; eliteFails++; }
    else if (eh >= EHP_WARN) { flag = "!! effHP high"; eliteWarns++; }
    if (ed >= DMG_FAIL) { flag += (flag ? " | " : "") + "*** dmg FAIL"; eliteFails++; }
    else if (ed >= DMG_WARN) { flag += (flag ? " | " : "") + "!! dmg high"; eliteWarns++; }
    if (stat && eh < 1.01 && ed < 1.01) flag = flag || "(on-hit DoT, no stat inflation)";
    console.log(pad(type + " + " + af.id, 30) + pad("x" + eh.toFixed(2), 12) + pad("x" + ed.toFixed(2), 10) + flag);
  }
}
console.log("\n" + (eliteFails ? ("ELITE FAIL: " + eliteFails + " affix combo(s) out of band")
  : (eliteWarns ? ("elite OK with " + eliteWarns + " warning(s)") : "elite OK: all affixes within fair band")));

process.exit((fails || eliteFails) ? 1 : 0);
