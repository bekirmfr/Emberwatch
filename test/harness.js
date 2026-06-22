/* Emberwatch headless harness (reconstructed) — smoke test + tag-system assertions.
   Stubs a browser env, evals the game, runs the loop, then asserts the tag/census/
   perTag wiring end-to-end. "ALL OK" + "loop ok" = pass. */
const fs = require('fs');
const path = require('path');

const HTML = path.join(__dirname, '..', 'emberwatch.html');
const code = [...fs.readFileSync(HTML, "utf8")
  .matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x => x[1]).join("\n");

const noop = () => {};
const grad = { addColorStop: noop };
const ctx2d = new Proxy({}, {
  get: (t, p) => {
    if (String(p).includes("Gradient")) return () => grad;
    if (p === "measureText") return () => ({ width: 0 });
    if (p === "getImageData") return () => ({ data: [] });
    if (p === "createImageData") return () => ({ data: [] });
    if (p === "canvas") return { width: 800, height: 600 };
    return noop;
  }
});
const rect = () => ({ width: 800, height: 600, left: 0, top: 0, right: 800, bottom: 600, x: 0, y: 0 });
function fakeEl() {
  return {
    style: new Proxy({}, { get: (t, p) => (p === "setProperty" || p === "removeProperty") ? noop : (p === "getPropertyValue" ? () => "" : (t[p] || "")), set: (t, p, v) => { t[p] = v; return true; } }), dataset: {}, width: 800, height: 600, value: "", textContent: "", innerHTML: "",
    clientWidth: 800, clientHeight: 600, offsetWidth: 800, offsetHeight: 600,
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    getContext: () => ctx2d, addEventListener: noop, removeEventListener: noop,
    appendChild: noop, removeChild: noop, insertBefore: noop, setAttribute: noop,
    removeAttribute: noop, getAttribute: () => null, querySelector: () => fakeEl(),
    querySelectorAll: () => [], getBoundingClientRect: rect, focus: noop, blur: noop,
    click: noop, remove: noop, cloneNode: () => fakeEl(), closest: () => null, contains: () => false
  };
}

const _ls = {};
const localStorage = {
  getItem: k => (k in _ls ? _ls[k] : null),
  setItem: (k, v) => { _ls[k] = String(v); },
  removeItem: k => { delete _ls[k]; }
};
global.__fetches = [];
global.fetch = (url, opts) => { global.__fetches.push({ url, body: opts && opts.body }); return Promise.resolve({}); };
global.localStorage = localStorage;
global.requestAnimationFrame = noop;
global.cancelAnimationFrame = noop;
global.setTimeout = () => 0;          // non-recursing (GOTCHA: fire crackle scheduler)
global.clearTimeout = noop;
global.setInterval = () => 0;
global.clearInterval = noop;
global.devicePixelRatio = 1;
global.innerWidth = 800; global.innerHeight = 600;
global.matchMedia = () => ({ matches: false, addEventListener: noop, addListener: noop });
global.addEventListener = noop;
global.removeEventListener = noop;
global.getComputedStyle = () => new Proxy({}, { get: () => "" });
global.alert = noop; global.prompt = () => null; global.confirm = () => false;
function param() { return { value: 0, setValueAtTime: noop, linearRampToValueAtTime: noop, exponentialRampToValueAtTime: noop, cancelScheduledValues: noop, setTargetAtTime: noop, setValueCurveAtTime: noop }; }
function audioNode() {
  return new Proxy({
    gain: param(), frequency: param(), detune: param(), Q: param(), pan: param(), playbackRate: param(),
    type: "", buffer: null, connect: () => audioNode(), disconnect: noop, start: noop, stop: noop
  }, { get: (t, p) => (p in t ? t[p] : noop) });
}
const Audio = function () {
  return new Proxy({
    createOscillator: audioNode, createGain: audioNode, createBiquadFilter: audioNode,
    createBufferSource: audioNode, createDynamicsCompressor: audioNode, createWaveShaper: audioNode,
    createStereoPanner: audioNode, createConvolver: audioNode, createAnalyser: audioNode, createDelay: audioNode,
    createBuffer: () => ({ getChannelData: () => new Float32Array(1) }),
    decodeAudioData: () => Promise.resolve({}), resume: () => Promise.resolve(),
    destination: {}, currentTime: 0, sampleRate: 44100, state: "running", listener: {}
  }, { get: (t, p) => (p in t ? t[p] : noop) });
};
global.AudioContext = Audio; global.webkitAudioContext = Audio;
global.document = {
  getElementById: () => fakeEl(), createElement: () => fakeEl(),
  createElementNS: () => fakeEl(), querySelector: () => fakeEl(),
  querySelectorAll: () => [], addEventListener: noop, removeEventListener: noop,
  body: fakeEl(), documentElement: fakeEl()
};
global.window = {
  localStorage, requestAnimationFrame: noop, cancelAnimationFrame: noop,
  addEventListener: noop, removeEventListener: noop, matchMedia: global.matchMedia,
  devicePixelRatio: 1, innerWidth: 800, innerHeight: 600,
  AudioContext: Audio, webkitAudioContext: Audio, setTimeout: global.setTimeout,
  clearTimeout: noop, fetch: global.fetch, location: { href: "", search: "" },
  navigator: { maxTouchPoints: 0, userAgent: "node" }
};

const test = [
  'function assert(c, m){ if(!c) throw new Error("ASSERT FAILED: " + m); }',

  // --- original smoke test: sim loop must not crash ---
  'startGame("ranger"); buildHotbar();',
  'for (var i = 0; i < 300; i++) { G.paused = false; update(1/60); }',   // ~5 simulated seconds
  'render();',
  'console.log("frames: 300, wave " + G.wave + ", level " + G.level + ", dead " + G.hero.dead);',
  'console.log("loop ok");',

  // --- ENGINE: perTag fold scales by owned tag count (deterministic, isolated) ---
  'var synthetic = { baseStats: mkStats({ attackDamage: 100 }), activeEffects: [],',
  '  sources: [{ modifiers: [{ stat:"attackDamage", op:"increased", value:0.10, perTag:"fire" }], triggers: [] }],',
  '  tagCount: { fire: 3 } };',
  'assert(Math.abs(resolveStat(synthetic, "attackDamage", ctx) - 130) < 1e-6, "perTag scales: 3 fire -> +30% (got " + resolveStat(synthetic,"attackDamage",ctx) + ")");',
  'synthetic.tagCount = { fire: 0 };',
  'assert(Math.abs(resolveStat(synthetic, "attackDamage", ctx) - 100) < 1e-6, "perTag zero fire -> no bonus");',
  'console.log("perTag fold ok");',

  // --- CENSUS: rebuild tallies perk tags onto hero.tagCount ---
  'startGame("ranger");',
  'var et = PERKS.find(p => p.nm === "Ember Touch"), py = PERKS.find(p => p.nm === "Pyromancer");',
  'G.hero.perks = [et.build(7), py.build(py.tiers[2])]; G.runMods = [];',   // clear the random start modifier — this test asserts an absolute tag count
  'rebuild(G.hero);',
  'assert(G.hero.tagCount && G.hero.tagCount.fire === 2, "census: Ember Touch + Pyromancer -> fire=2 (got " + JSON.stringify(G.hero.tagCount) + ")");',
  'console.log("census ok");',

  // --- ITEM WIRING: rolled elemental-proc items carry their theme tag ---
  'var emberSeen=0, venomSeen=0, mism=0;',
  'for (var i=0;i<2000;i++){ var it = rollItem(20, 2);',
  '  var isE = / of Embers/.test(it.nm), isV = / of Venom/.test(it.nm);',
  '  if (isE){ emberSeen++; if (!(it.tags && it.tags.indexOf("fire")>=0)) mism++; }',
  '  if (isV){ venomSeen++; if (!(it.tags && it.tags.indexOf("poison")>=0)) mism++; }',
  '}',
  'assert(emberSeen>0 && venomSeen>0, "saw elemental procs (ember="+emberSeen+", venom="+venomSeen+")");',
  'assert(mism===0, "every elemental-proc item carries its tag (mismatches="+mism+")");',
  'console.log("item-tag wiring ok: ember="+emberSeen+", venom="+venomSeen);',

  // --- INTEGRATION: a fire item raises the census, which raises Pyromancer damage ---
  'startGame("ranger");',
  'G.hero.perks = [PERKS.find(p=>p.nm==="Pyromancer").build(0.12)]; G.runMods = [];',
  'rebuild(G.hero); var adBefore = resolveStat(G.hero, "attackDamage", ctx); var fireBefore = (G.hero.tagCount.fire||0);',
  'var fireItem = { id:"t_fire", slot:"ring", tags:["fire"], modifiers:[], triggers:[], procDs:[] };',
  'G.hero.sources.push(fireItem);',                                  // simulate an equipped fire source in the resolved list
  'var tc={}; for (var s of G.hero.sources) for (var tg of (s.tags||[])) tc[tg]=(tc[tg]||0)+1; G.hero.tagCount=tc;',
  'var adAfter = resolveStat(G.hero, "attackDamage", ctx);',
  'assert(G.hero.tagCount.fire === fireBefore + 1, "adding a fire item increments fire census");',
  'assert(adAfter > adBefore, "more fire sources -> Pyromancer raises AD ("+adBefore+" -> "+adAfter+")");',
  'console.log("integration ok: AD " + adBefore.toFixed(2) + " -> " + adAfter.toFixed(2));',

  // ===== PHASE 0: proc-chain mask makes a self-referential loop FINITE =====
  // A trigger that, on a kill, spawns a true-damage payload at an already-dead target would
  // re-emit onKill forever without the mask. With it, the proc fires once per chain and stops.
  'startGame("ranger");',
  'var _origRA = resolveAttack, raCount = 0;',
  'resolveAttack = function(){ raCount++; return _origRA.apply(null, arguments); };',
  'G.hero.sources.push({ id:"loop", modifiers:[], triggers:[{ on:"onKill", source:"LoopProc", effect:{ kind:"spawnPayload", of:{ mode:"flat", amount:{ type:"flat", value:5 } } } }] });',
  'var corpse = { id:"corpse", currentHealth:-1, x:G.hero.x+10, y:G.hero.y, dead:false, baseStats:mkStats({}), sources:[], activeEffects:[], tags:[] };',
  'var threw=false; try { emit({ type:"onKill", self:G.hero, other:corpse }); } catch(e){ threw=true; }',
  'assert(!threw, "proc loop terminates without throwing (no stack overflow)");',
  'assert(raCount === 1, "mask: LoopProc spawns exactly once per chain (got " + raCount + ")");',
  'resolveAttack = _origRA; G.hero.sources.pop();',
  'assert(typeof _CHAIN_MAX === "number" && _CHAIN_MAX > 0, "depth cap backstop exists");',
  'console.log("phase0 ok: loop bounded, raCount=" + raCount);',

  // ===== PHASE 1: runtime scaling types + hyperbolic + threshold =====
  'function mkActor(stats){ return { baseStats: mkStats(stats||{}), sources:[], activeEffects:[], tagCount:{} }; }',

  // per:kill — linear in killCount
  'var aK = mkActor({ attackDamage:10 }); aK.killCount = 5;',
  'aK.sources = [{ modifiers:[{ stat:"attackDamage", op:"flat", value:2, per:"kill" }] }];',
  'assert(resolveStat(aK,"attackDamage",ctx) === 20, "per:kill 10 + 2*5 = 20 (got " + resolveStat(aK,"attackDamage",ctx) + ")");',

  // per:second — floor(combatTime)
  'var aS = mkActor({ attackDamage:10 }); aS.combatTime = 3.7;',
  'aS.sources = [{ modifiers:[{ stat:"attackDamage", op:"flat", value:1, per:"second" }] }];',
  'assert(resolveStat(aS,"attackDamage",ctx) === 13, "per:second 10 + 1*floor(3.7)=13 (got " + resolveStat(aS,"attackDamage",ctx) + ")");',

  // per:enemyNearby — reads ctx.nearbyEnemies
  'var aN = mkActor({ attackDamage:10 }); var _nb = ctx.nearbyEnemies; ctx.nearbyEnemies = 4;',
  'aN.sources = [{ modifiers:[{ stat:"attackDamage", op:"increased", value:0.05, per:"enemyNearby" }] }];',
  'assert(Math.abs(resolveStat(aN,"attackDamage",ctx) - 12) < 1e-9, "per:enemyNearby 10*(1+0.05*4)=12 (got " + resolveStat(aN,"attackDamage",ctx) + ")");',
  'ctx.nearbyEnemies = _nb;',

  // hyperbolic — approaches but never reaches 1, and is monotonic in stacks
  'var aH = mkActor({ evasion:0 });',
  'aH.sources = [{ modifiers:[{ stat:"evasion", op:"hyperbolic", value:1 }, { stat:"evasion", op:"hyperbolic", value:1 }] }];',
  'var ev2 = resolveStat(aH,"evasion",ctx);',
  'aH.sources = [{ modifiers:[{ stat:"evasion", op:"hyperbolic", value:1000 }] }];',
  'var evBig = resolveStat(aH,"evasion",ctx);',
  'assert(Math.abs(ev2 - 0.6666666667) < 1e-6, "hyperbolic hyp=2 -> 0.667 (got " + ev2 + ")");',
  'assert(evBig < 1 && evBig > ev2, "hyperbolic asymptotes below 1 (big=" + evBig.toFixed(4) + ")");',

  // threshold — selfStatAtLeast gates a modifier on a breakpoint
  'var aT = mkActor({ armor:50, maxHealth:100 });',
  'aT.sources = [{ modifiers:[{ stat:"maxHealth", op:"flat", value:200, condition:{ kind:"selfStatAtLeast", stat:"armor", value:100 } }] }];',
  'assert(resolveStat(aT,"maxHealth",ctx) === 100, "threshold OFF below breakpoint (armor 50)");',
  'aT.baseStats.armor = 150;',
  'assert(resolveStat(aT,"maxHealth",ctx) === 300, "threshold ON at/above breakpoint (armor 150 -> +200 HP)");',
  'console.log("phase1 ok: per-kill/second/enemyNearby, hyperbolic, threshold all verified");',

  // ===== PHASE 2: threshold detonate / tag-gated trigger / convert / AoE spread =====
  'function dummy(stats){ return { id:"d"+Math.random(), currentHealth:1e9, x:0, y:0, dead:false, baseStats:mkStats(stats||{maxHealth:1e9}), sources:[], activeEffects:[], tags:[] }; }',

  // (a) detonate: 5 poison stacks consumed for a burst
  'startGame("ranger");',
  'var dD = dummy(); for (var i=0;i<6;i++) applyEffectTemplate(dD, POISON);',
  'var ps=0; for (var e of dD.activeEffects) if (e.source==="Poison") ps+=(e.stacks||1);',
  'assert(ps>=5, "poison reached 5 stacks (got "+ps+")");',
  'G.hero.sources.push(PERKS.find(p=>p.nm==="Rupture").build(10));',
  'var hpD=dD.currentHealth; emit({ type:"onHitDealt", self:G.hero, other:dD, payload:{} });',
  'assert(dD.currentHealth < hpD, "detonate dealt burst damage");',
  'assert(!dD.activeEffects.some(e=>e.source==="Poison"), "detonate consumed the poison stacks");',
  'G.hero.sources.pop();',
  'console.log("phase2 detonate ok");',

  // (b) tag-gated trigger: Opportunist fires only at 2+ statuses
  'startGame("ranger");',
  'var dO = dummy(); G.hero.sources.push(PERKS.find(p=>p.nm==="Opportunist").build(24));',
  'applyEffectTemplate(dO, BURN); var o1=dO.currentHealth; emit({type:"onHitDealt", self:G.hero, other:dO, payload:{}});',
  'assert(dO.currentHealth === o1, "opportunist OFF with 1 status");',
  'applyEffectTemplate(dO, POISON); var o2=dO.currentHealth; emit({type:"onHitDealt", self:G.hero, other:dO, payload:{}});',
  'assert(dO.currentHealth < o2, "opportunist ON with 2 statuses");',
  'G.hero.sources.pop();',
  'console.log("phase2 tag-gated ok");',

  // (c) convert: a source with convert makes basics deal true damage (ignore armor)
  'startGame("ranger");',
  'G.hero.sources.push({ id:"cvt", convert:{ damageType:"true" }, modifiers:[], triggers:[] });',
  'assert(basicInstance(G.hero, ctx, ["melee"]).damageType === "true", "convert -> true damage");',
  'var dC = dummy({armor:100, maxHealth:1e9}); var cBefore=dC.currentHealth;',
  'resolveAttack(G.hero, dC, Object.assign(basicInstance(G.hero,ctx,["melee"]),{critChance:0,canCrit:false}), ctx);',
  'var dealt=cBefore-dC.currentHealth, expAD=resolveStat(G.hero,"attackDamage",ctx);',
  'assert(Math.abs(dealt-expAD) < 1e-6, "true damage ignores 100 armor (dealt "+dealt.toFixed(2)+" vs AD "+expAD.toFixed(2)+")");',
  'G.hero.sources.pop();',
  'console.log("phase2 convert ok");',

  // (d) applyAoE: Wildfire spreads burn within radius, not beyond
  'startGame("ranger");',
  'G.hero.sources.push(PERKS.find(p=>p.nm==="Wildfire").src);',
  'var center=dummy(), nearF=dummy({maxHealth:100}), farF=dummy({maxHealth:100});',
  'center.x=0; nearF.x=20; farF.x=400;',
  'G.enemies=[center, nearF, farF];',
  'emit({ type:"onCrit", self:G.hero, other:center, payload:{} });',
  'assert(nearF.activeEffects.some(e=>e.source==="Burn"), "wildfire spreads burn to nearby foe");',
  'assert(!farF.activeEffects.some(e=>e.source==="Burn"), "wildfire respects radius (far foe unburned)");',
  'G.hero.sources.pop();',
  'console.log("phase2 aoe-spread ok");',

  // (e) regression: self-conditioned triggers still gate after the collectTriggers refactor
  'startGame("ranger");',
  'var dR=dummy(); G.hero.sources.push({ id:"cond", modifiers:[], triggers:[{ on:"onHitDealt", source:"CondProbe", condition:{kind:"selfHealthBelow", pct:0.5}, effect:{ kind:"spawnPayload", of:{ mode:"flat", amount:{type:"flat", value:50} } } }] });',
  'G.hero.currentHealth = resolveStat(G.hero,"maxHealth",ctx); var r1=dR.currentHealth; emit({type:"onHitDealt", self:G.hero, other:dR, payload:{}});',
  'assert(dR.currentHealth === r1, "self-condition gates OFF at full HP");',
  'G.hero.currentHealth = 1; var r2=dR.currentHealth; emit({type:"onHitDealt", self:G.hero, other:dR, payload:{}});',
  'assert(dR.currentHealth < r2, "self-condition fires at low HP");',
  'G.hero.sources.pop();',
  'console.log("phase2 self-condition regression ok");',

  // ===== SEEDED RNG: reproducibility, seed-sensitivity, cosmetic stream isolation =====
  'function genSeq(){ var out=[]; for (var i=0;i<8;i++){ var it=rollItem(20,2); out.push(it.rarity+"|"+it.set+"|"+(it.tags||[]).join(",")+"|"+it.value); } return out.join(";"); }',
  'seedRun(424242); var seqA=genSeq();',
  'seedRun(424242); var seqB=genSeq();',
  'assert(seqA === seqB, "same seed -> identical loot sequence");',
  'seedRun(999); var seqC=genSeq();',
  'assert(seqA !== seqC, "different seed -> different loot sequence");',
  // cosmetic draws (cri/crand) must NOT advance the gameplay stream
  'seedRun(7); var g1=[]; for (var i=0;i<5;i++) g1.push(grng());',
  'seedRun(7); for (var i=0;i<50;i++) cri(-9,9); var g2=[]; for (var i=0;i<5;i++) g2.push(grng());',
  'assert(JSON.stringify(g1) === JSON.stringify(g2), "cosmetic stream does not perturb the gameplay stream");',
  // daily seed is stable per UTC date and varies across dates
  'assert(dailySeed(new Date("2026-06-21T00:00:00Z")) === dailySeed(new Date("2026-06-21T23:00:00Z")), "daily seed stable across a UTC day");',
  'assert(dailySeed(new Date("2026-06-21T00:00:00Z")) !== dailySeed(new Date("2026-06-22T00:00:00Z")), "daily seed changes day-to-day");',
  'console.log("seeded-rng ok: reproducible + seed-sensitive + cosmetic-isolated");',

  // ===== DAILY CONTENT-DETERMINISM: play-order-independence =====
  // (a) wave composition depends only on (master seed, wave number) — not on the live/combat stream
  'startGame("ranger"); seedRun(31337); G._tut0Pending=false; G._tut0=false; G.isNight=true;',
  'G.wave=4; startWave(); var qA = G.spawnQueue.map(x=>x.key).join(",");',
  'for (var i=0;i<300;i++) grng();',                                  // simulate combat churning the live stream
  'G.wave=4; startWave(); var qB = G.spawnQueue.map(x=>x.key).join(",");',
  'assert(qA === qB, "wave composition identical despite live-stream churn (got A=["+qA+"] B=["+qB+"])");',

  // (b) loot per enemy depends only on (master seed, spawn ordinal, spawn wave) — NOT on kill order
  'var es = [{tag:"brute",spawnIdx:1,spawnWave:3},{tag:"brute",spawnIdx:2,spawnWave:3},{tag:"brute",spawnIdx:3,spawnWave:3}];',
  'function lootSig(arr){ return arr.map(it=>it.rarity+"|"+it.set+"|"+it.value+"|"+(it.tags||[]).join(",")+"|"+it.modifiers.map(m=>m.stat+":"+m.value).join(",")).join(" ;; "); }',
  'seedRun(31337);',
  'var a1=lootSig(rollEnemyLoot(es[0])), a2=lootSig(rollEnemyLoot(es[1])), a3=lootSig(rollEnemyLoot(es[2]));',
  'for (var i=0;i<500;i++) grng();',                                  // churn live stream (combat between kills)
  'var b3=lootSig(rollEnemyLoot(es[2])), b1=lootSig(rollEnemyLoot(es[0])), b2=lootSig(rollEnemyLoot(es[1]));',  // reversed kill order
  'assert(a1===b1 && a2===b2 && a3===b3, "loot per enemy identical regardless of kill order + combat churn");',

  // (c) sub-seed mechanism: reproducible, live-stream-independent, varies by index and domain
  'seedRun(31337); var ps=subSeed("perk",3); for (var i=0;i<100;i++) grng(); assert(subSeed("perk",3)===ps, "subSeed independent of live stream");',
  'seedRun(31337); assert(subSeed("perk",3)===ps, "subSeed reproducible from master seed");',
  'assert(subSeed("perk",3)!==subSeed("perk",4), "subSeed varies by index");',
  'assert(subSeed("perk",3)!==subSeed("wave",3), "subSeed varies by domain");',
  // and a different master seed yields different content
  'seedRun(42); assert(subSeed("perk",3)!==ps, "different master seed -> different sub-stream");',
  'console.log("daily-determinism ok: waves + loot play-order-independent, sub-seed sound");',

  // ===== DAILY ENTRY: startDaily seeds from the date and fixes class by seed =====
  'startDaily();',
  'assert(G.isDaily === true, "startDaily marks the run as a daily");',
  'assert(G.runSeed === dailySeed(), "daily run seeded from today\\u2019s date");',
  'assert(G.classId === PICK_ORDER[dailySeed() % PICK_ORDER.length], "daily class fixed by the seed");',
  // replaying the daily yields the same seed + class (shared, repeatable challenge)
  'var firstSeed = G.runSeed, firstCls = G.classId; startDaily();',
  'assert(G.runSeed === firstSeed && G.classId === firstCls, "daily is repeatable (same seed + class today)");',
  'console.log("daily-entry ok: seed=" + G.runSeed + " class=" + G.classId);',

  // ===== DAILY FAIRNESS + LEADERBOARD =====
  'assert(typeof DAILY_BOARD !== "undefined" && DAILY_BOARD === "lb_5bf09b66efac629b40179d2c", "daily board key present");',
  'assert(Scores.hasDaily() === true, "daily leaderboard provider is wired");',
  'assert(!!LB.dailyDevSecret, "daily client write path is active (owner-accepted)");',
  // revive is disabled on a daily run (one life — same rules for everyone)
  'startDaily(); embers = 9999; G.hero.dead = true; G.dying = true;',
  'revive();',
  'assert(G.hero.dead === true && G.dying === true, "revive is a no-op during a daily run");',
  // revive still works on a normal run
  'startGame("ranger"); embers = 9999; G.hero.dead = true; G.dying = true; G.deathT = 0;',
  'revive();',
  'assert(G.hero.dead === false, "revive still works on a normal run");',
  // daily provider tags entries with the challenge date (read filters by it)
  'assert(typeof Scores.submitDaily === "function", "daily submit path exists");',
  'console.log("daily-fairness ok: no revive on daily, daily board write path active");',
  // ===== i18n: Daily Challenge localized in all languages =====
  'assert(STRINGS.en.dailyChallenge === "Daily Challenge", "EN dailyChallenge present");',
  'assert(!!STRINGS.tr.dailyChallenge && !!STRINGS.ja.dailyChallenge && !!STRINGS.ar.dailyChallenge, "dailyChallenge translated (tr/ja/ar)");',
  'assert(Object.keys(STRINGS).every(function(l){return !!STRINGS[l].dailyChallenge;}), "dailyChallenge present in every language");',
  'console.log("i18n ok: dailyChallenge in " + Object.keys(STRINGS).length + " languages");',

  // ===== DAILY: once-per-day lock + accepted-flag plumbing =====
  'var _ds = dailySeed(); Store.set(dailyAttemptKey(_ds), 0);',          // reset today\u2019s attempt
  'assert(dailyAttempted(_ds) === false, "daily not attempted after reset");',
  'startDaily();',
  'assert(dailyAttempted(_ds) === true, "starting a daily marks the attempt spent (at START)");',
  'assert(G.isDaily === true, "daily run actually started");',
  'G._probe = 12345;',                                                  // tag the current run object
  'startDaily();',                                                      // second attempt the same day
  'assert(G._probe === 12345, "second startDaily does NOT start a new run (locked to one/day)");',
  // server accepted-flag plumbing: submit returns the body, submitDaily is awaitable
  'var _pr = Scores.submitDaily({score:100,wave:1,level:1,kills:0,days:1,cls:"mage"}, _ds);',
  'assert(_pr && typeof _pr.then === "function", "submitDaily returns a promise (so gameOver can read accepted)");',
  // daily-status strings localized everywhere
  'assert(STRINGS.en.dailyRecorded && STRINGS.en.dailyAlready && STRINGS.en.dailyRecording && STRINGS.en.dailySavedLocal, "EN daily-status strings present");',
  'assert(Object.keys(STRINGS).every(function(l){return STRINGS[l].dailyRecorded && STRINGS[l].dailyAlready && STRINGS[l].dailyRecording && STRINGS[l].dailySavedLocal;}), "daily-status strings in every language");',
  'Store.set(dailyAttemptKey(_ds), 0);',                                // leave today playable for the human
  'console.log("daily-lock ok: one attempt/day, status localized, submit reactive to accepted");',

  // ===== PHASE 4: enemy affixes =====
  'startGame("ranger"); seedRun(777); G._tut0Pending=false; G._tut0=false; G.wave=14;',
  'G.spawnIndex=50; G.enemies.length=0; spawnEnemy("grunt"); var _e1=G.enemies[G.enemies.length-1]; var _afx1=(_e1.affixes||[]).join(",");',
  'for (var i=0;i<400;i++) grng();',                                    // churn live stream
  'G.spawnIndex=50; spawnEnemy("grunt"); var _e2=G.enemies[G.enemies.length-1]; var _afx2=(_e2.affixes||[]).join(",");',
  'assert(_afx1 === _afx2, "affixes identical for same spawn ordinal regardless of live churn (play-order-independent)");',
  // exercise the REAL roll path (pickEnemyAffix via spawnEnemy) — would throw if it collided with item pickAffix
  'startGame("ranger"); seedRun(123); G._tut0Pending=false; G._tut0=false; G.wave=20; G.enemies.length=0;',
  'for (var i=0;i<60;i++) spawnEnemy("grunt");',
  'var _elites=0; for (var i=0;i<G.enemies.length;i++) if (G.enemies[i].elite) _elites++;',
  'assert(_elites > 0, "affixes actually roll AND apply through spawnEnemy (got "+_elites+"/60 elites)");',
  'var _el = G.enemies.find(function(e){return e.elite;}); assert(_el && _el.sources.some(function(s){return s.id&&s.id.indexOf("affix_")===0;}), "elite carries an affix_ source folded into its sources");',
  // affix actually folds through resolveStat + flags/reward
  'var _vg = {tag:"grunt", sources:[{id:"arch",modifiers:[],triggers:[]}], baseStats: mkStats({maxHealth:32,attackDamage:8,moveSpeed:62,armor:2,critMultiplier:1.5}), xp:3, gold:[1,3], r:13, activeEffects:[]};',
  'var _hp0 = resolveStat(_vg,"maxHealth",ctx); applyAffix(_vg, ENEMY_AFFIXES.find(a=>a.id==="vigorous")); var _hp1 = resolveStat(_vg,"maxHealth",ctx);',
  'assert(_hp1 > _hp0 * 1.5, "Vigorous affix raises maxHealth via the more multiplier");',
  'assert(_vg.elite === true && _vg.xp > 3, "affixed enemy is flagged elite and worth more");',
  // on-hit affix is a real trigger source on the enemy
  'var _ven = ENEMY_AFFIXES.find(a=>a.id==="venomous").build(); assert(_ven.triggers[0].on === "onHitDealt", "Venomous is an onHitDealt trigger (fires on enemy hits)");',

  // ===== PHASE 4: run modifiers =====
  'startGame("ranger");',
  'assert(Array.isArray(G.runMods) && G.runMods.length === 1, "exactly one run modifier assigned at start");',
  'assert(G.hero.sources.some(s=>s.id && s.id.indexOf("runmod_")===0), "run modifier folded into hero sources via rebuild");',
  'var _n0 = G.runMods.length; grantRunMod("juggernaut");',
  'assert(G.runMods.length === _n0+1, "grantRunMod stacks another modifier");',
  'assert(G.hero.sources.filter(s=>s.id&&s.id.indexOf("runmod_")===0).length === _n0+1, "stacked modifier present in sources after rebuild");',
  // daily run modifier is deterministic for the day
  '_dailyPending = dailySeed(); startGame("mage"); var _dm1 = G.runMods[0].id;',
  '_dailyPending = dailySeed(); startGame("mage"); var _dm2 = G.runMods[0].id;',
  'assert(_dm1 === _dm2, "daily run modifier is deterministic for the day");',
  'console.log("phase4 ok: affixes deterministic+folded, run mods assigned/stacked/daily-deterministic");',
  // relic drops deterministic per spawn ordinal (daily-safe) + always a valid mod or null
  'seedRun(2024); var _re={spawnIdx:9}; var _r1=rollEliteRelic(_re); for (var i=0;i<300;i++) grng(); var _r2=rollEliteRelic(_re);',
  'assert(_r1===_r2, "elite relic identical per spawn ordinal regardless of live churn");',
  'assert(_r1===null || runModById(_r1), "relic grants a valid run modifier (or none)");',
  'console.log("phase4 relics ok: deterministic elite relic drops -> run mods");',
  // run-mod values: relics are capped at RELIC_CAP, so per-unit values can be meatier — but bounded scalers
  // (perMax) and count-scaled (per:relic) totals must still stay sane so no single relic runs away.
  '(function(){ var bad=[]; for (var i=0;i<RUN_MODS.length;i++){ var b=RUN_MODS[i].build(); for (var j=0;j<b.modifiers.length;j++){ var m=b.modifiers[j]; var lim = m.op==="more" ? (m.condition?0.30:0.15) : (m.op==="increased"?0.25 : (FRAC.has(m.stat)?0.06:8)); if (Math.abs(m.value) > lim+1e-9) bad.push(RUN_MODS[i].id+"."+m.stat+"("+m.op+(m.condition?",cond":"")+")="+m.value+">"+lim); if (m.perMax!=null){ var tot=Math.abs(m.value*m.perMax); var tl=(m.op==="flat")?(FRAC.has(m.stat)?0.6:80):1.0; if (tot>tl+1e-9) bad.push(RUN_MODS[i].id+"."+m.stat+" perMax-total="+tot+">"+tl); } if (m.per==="relic"){ var ct=Math.abs(m.value*RELIC_CAP); var cl=(m.op==="flat")?80:0.5; if (ct>cl+1e-9) bad.push(RUN_MODS[i].id+"."+m.stat+" per:relic@cap="+ct+">"+cl); } } } assert(bad.length===0, "run-mod values within capped-regime bounds; offenders: "+bad.join(", ")); })();',
  // stacking stays controlled even at the relic cap: 10x Glass Cannon survivable, 10x Zealot not guaranteed-crit
  'startGame("ranger"); G.runMods=[]; rebuild(G.hero); var _baseHp = resolveStat(G.hero,"maxHealth",ctx);',
  'for (var i=0;i<10;i++) grantRunMod("glasscannon"); assert(resolveStat(G.hero,"maxHealth",ctx) > _baseHp*0.45, "10x Glass Cannon stays survivable");',
  'G.runMods=[]; rebuild(G.hero); for (var i=0;i<10;i++) grantRunMod("zealot"); assert(resolveStat(G.hero,"critChance",ctx) < 0.75, "10x Zealot crit stays controlled (not guaranteed-crit even at the relic cap)");',
  // Bloodthirst per:kill is bounded by perMax — a million kills cannot keep scaling it
  'startGame("ranger"); G.runMods=[]; G.hero.killCount=0; rebuild(G.hero); grantRunMod("bloodthirst"); var _adK0 = resolveStat(G.hero,"attackDamage",ctx);',
  'G.hero.killCount = 1000000; var _adK1 = resolveStat(G.hero,"attackDamage",ctx); G.hero.killCount = 50; var _adK50 = resolveStat(G.hero,"attackDamage",ctx);',
  'assert(_adK1 > _adK0 && Math.abs(_adK1 - _adK50) < 1e-6, "Bloodthirst per:kill is capped at perMax (no kill-driven runaway)");',
  'console.log("run-mod balance ok: values bounded, stacking gentle, per:kill capped");',

  // ===== interacting relics =====
  // Resonance scales with how many relics you hold (relic-to-relic interaction)
  'startGame("ranger"); G.runMods=[]; rebuild(G.hero); var _adB = resolveStat(G.hero,"attackDamage",ctx);',
  'grantRunMod("resonance"); var _ad1 = resolveStat(G.hero,"attackDamage",ctx);',
  'grantRunMod("resonance"); grantRunMod("resonance"); grantRunMod("resonance"); var _ad4 = resolveStat(G.hero,"attackDamage",ctx);',
  'assert(_ad1 > _adB && _ad4 > _ad1 * 1.2, "Resonance scales with relic count (per:relic)");',
  // Last Stand is conditional — only applies below the health threshold
  'G.runMods=[]; rebuild(G.hero); grantRunMod("laststand");',
  'G.hero.currentHealth = resolveStat(G.hero,"maxHealth",ctx); var _full = resolveStat(G.hero,"attackDamage",ctx);',
  'G.hero.currentHealth = resolveStat(G.hero,"maxHealth",ctx) * 0.2; var _low = resolveStat(G.hero,"attackDamage",ctx);',
  'assert(_low > _full, "Last Stand: damage rises only when wounded (conditional fold)");',
  // Annihilation is gone
  'assert(!PERKS.find(function(p){return p.nm==="Annihilation";}), "Annihilation perk removed");',
  'console.log("interacting relics ok: per-relic scaling + conditional threshold; annihilation removed");',

  // ===== relic descriptions are numeric (value-derived, never drift) =====
  'startGame("ranger"); G.runMods=[];',
  'var _rmGc = runModDesc(runModById("glasscannon"));',
  'assert(/\\+10% .*Damage/.test(_rmGc) && /Health/.test(_rmGc) && !/More/i.test(_rmGc), "runModDesc is numeric, not qualitative (glasscannon: "+_rmGc+")");',
  'var _rmBp = runModDesc(runModById("bloodpact"));',
  'assert(/-0\\.5 /.test(_rmBp) && /heal/i.test(_rmBp) && /on kill/i.test(_rmBp), "runModDesc keeps small decimals + shows triggers (bloodpact: "+_rmBp+")");',
  'var _rmRs = runModDesc(runModById("resonance"));',
  'assert(/\\/ relic/.test(_rmRs), "runModDesc shows per-relic scaling (resonance: "+_rmRs+")");',
  'var _rmBt = runModDesc(runModById("bloodthirst"));',
  'assert(/60% .*Damage/.test(_rmBt) && /ramps/.test(_rmBt) && !/\\/ kill/.test(_rmBt), "runModDesc shows bounded per:kill as a capped total (bloodthirst: "+_rmBt+")");',
  'var _rmLs = runModDesc(runModById("laststand"));',
  'assert(/while <35% HP/.test(_rmLs), "runModDesc shows conditions (laststand: "+_rmLs+")");',
  'console.log("relic desc ok: numeric values, decimals, per-scaling, conditions");',

  // ===== relic pickup consent: Take grants+removes, Leave removes without granting =====
  'startGame("ranger"); G.runMods=[]; rebuild(G.hero);',
  'var _rpDrop = { relic:"juggernaut", x:0, y:0, dead:false }; G._relicPick = _rpDrop; var _rpN0 = G.runMods.length;',
  'takeRelic();',
  'assert(G.runMods.length === _rpN0+1 && _rpDrop.dead === true && G._relicPick === null, "Take grants the relic and removes the drop");',
  'var _rpDrop2 = { relic:"zealot", x:0, y:0, dead:false }; G._relicPick = _rpDrop2; var _rpN1 = G.runMods.length;',
  'leaveRelic();',
  'assert(G.runMods.length === _rpN1 && _rpDrop2.dead === true && G._relicPick === null, "Leave removes the relic without granting it");',
  'console.log("relic consent ok: Take grants+removes, Leave removes only");',

  // ===== double-collect guard: a collected (dead) drop must not re-open the card =====
  'startGame("ranger"); G.runMods=[]; G._relicPick=null; rebuild(G.hero);',
  'var _ddrop = { relic:"glasscannon", x:0, y:0, dead:false }; openRelicPick(_ddrop); takeRelic(); var _afterTake = G.runMods.length;',
  'assert(_ddrop.dead === true && G._relicPick === null, "after Take the drop is dead and the prompt is cleared");',
  'openRelicPick(_ddrop);',   // simulate the next frame re-touching the still-in-list dead drop (the bug path)
  'assert(G._relicPick === null && G.runMods.length === _afterTake, "a dead drop does not re-open the card or grant again (no double-collect)");',
  'var _o1 = { relic:"zealot", x:0,y:0,dead:false }; openRelicPick(_o1); var _o2 = { relic:"harvest", x:0,y:0,dead:false }; openRelicPick(_o2);',
  'assert(G._relicPick === _o1, "a second relic cannot open a prompt while one is already up"); leaveRelic();',
  'console.log("relic double-collect guard ok: dead/duplicate prompts ignored");',

  // ===== relic slot cap + swap-or-leave =====
  'startGame("ranger"); G.runMods=[]; rebuild(G.hero); for (var i=0;i<RELIC_CAP;i++) grantRunMod("zealot");',
  'G._relicPick = { relic:"glasscannon", x:0, y:0, dead:false }; takeRelic();',
  'assert(G.runMods.length === RELIC_CAP, "takeRelic refuses past the cap (bag full must swap)");',
  'G._relicPick = { relic:"juggernaut", x:0, y:0, dead:false }; swapRelic(0);',
  'assert(G.runMods.length === RELIC_CAP && G.runMods.some(function(r){return r.id==="runmod_juggernaut";}), "swapRelic holds at cap and inserts the new relic");',
  'assert(RELIC_CAP >= 6 && RELIC_CAP <= 16, "relic cap is in the intended band");',
  'console.log("relic cap ok: bag bounded at "+RELIC_CAP+", swap-or-leave when full");',

  // ===== crit-storm slow-mo fix: per-hit hitstop bounded + rate-limited =====
  'startGame("ranger"); var _dh = dummy({maxHealth:200}); _dh.x=0; _dh.y=0; _dh.r=12; G._hitHsLast=-1; G.hitStop=0;',
  'onDamage(_dh, 80, true, {tags:["melee"], kind:"basic"}); var _hs1 = G.hitStop;',
  'assert(_hs1 > 0 && _hs1 <= 0.056, "per-hit hitstop is bounded (<=0.055)");',
  'onDamage(_dh, 80, true, {tags:["melee"], kind:"basic"}); onDamage(_dh, 80, true, {tags:["melee"], kind:"basic"});',
  'assert(G.hitStop <= 0.056, "rapid repeated crits do not accumulate hitstop beyond the cap (no sim starvation)");',
  'console.log("hitstop ok: per-hit freeze bounded + rate-limited (crit-storm slow-mo fixed)");'
].join("\n");

let err = null;
try { eval(code + "\n" + test); } catch (e) { err = e; }
console.log(err
  ? ("ERROR: " + err.message + "\n" + (err.stack || "").split("\n").slice(0, 4).join("\n"))
  : "ALL OK");
process.exit(err ? 1 : 0);
