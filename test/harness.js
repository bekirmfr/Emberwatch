/* Emberwatch headless harness (reconstructed) — smoke test + tag-system assertions.
   Stubs a browser env, evals the game, runs the loop, then asserts the tag/census/
   perTag wiring end-to-end. "ALL OK" + "loop ok" = pass. */
const fs = require('fs');
const path = require('path');

const HTML = path.join(__dirname, '..', 'emberwatch.html');
const code = [...fs.readFileSync(HTML, "utf8")
    .matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x => x[1]).join("\n");

const noop = () => { };
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
    'G.hero.perks = [et.build(7), py.build(py.tiers[2])];',
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
    'G.hero.perks = [PERKS.find(p=>p.nm==="Pyromancer").build(0.12)];',
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

    // (c) convert: Annihilation makes basics ignore armor
    'startGame("ranger");',
    'G.hero.sources.push(PERKS.find(p=>p.nm==="Annihilation").src);',
    'assert(basicInstance(G.hero, ctx, ["melee"]).damageType === "true", "annihilation -> true damage");',
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
    'console.log("i18n ok: dailyChallenge in " + Object.keys(STRINGS).length + " languages");'
].join("\n");

let err = null;
try { eval(code + "\n" + test); } catch (e) { err = e; }
console.log(err
    ? ("ERROR: " + err.message + "\n" + (err.stack || "").split("\n").slice(0, 4).join("\n"))
    : "ALL OK");
process.exit(err ? 1 : 0);