/* reaction-contract.test.js — Phase 0 gate for the Reactor Composer.

   Proves the AMBIENT + GREEDY + MOST-SPECIFIC-WINS reaction resolver obeys the three
   properties every bridge in the system must obey, BEFORE any of it touches the game:

     1. DETERMINISM (most-specific-wins) — the richest qualifying reaction fires, and the
        choice does NOT depend on registry declaration order. This is what removes the
        contested-pair ordering bug: selection is by subset size, not key order.
     2. GREEDY (single-pass) — exactly ONE reaction resolves per swing; no cascade, no
        re-scan. Mirrors the engine's single-pass invariant (orderfuzz: zero re-entries).
     3. CONSERVATION — a reaction CONSUMES the statuses it reacts (removes them) and its
        payoff is BOUNDED by what it consumed (produced <= CONS_FACTOR * stacks spent).
        This is the structural defence against the one runaway class orderfuzz flags:
        "power must not scale BOTH a DoT and its detonation." A reaction spends the DoT
        INSTEAD of letting it tick — never both.

   Pure logic, no engine/simlib dependency — runnable with `node reaction-contract.test.js`.
   This file defines the CONTRACT; the Phase 1 game code (runReactions) must satisfy it.

   Note: chill's status source is "Frostbite" (chillTpl in emberwatch.html), NOT "Chill".
   Reactions key on the real source string or they silently never fire.
*/

"use strict";

// --- the registry: a power-set over the 3 base statuses. Entries are optional; gaps are fine.
//     consume = which statuses are spent · threshold = min total stacks across consumed sources
//     produce(n, power, mark) = payoff as a function of stacks spent (so it scales with the pile forfeited)
//     CONS_FACTOR bounds payoff vs consumption; real magnitudes are tuned later by the progression sim.
const CONS_FACTOR = 2.0;                 // a reaction may pay out at most 2x the raw stacks it spends
const REACTIONS = {
  // pairs
  "Burn|Poison":          { consume: ["Burn", "Poison"],              threshold: 5, produce: (n, p, m) => 1.0 * n * p * m },
  "Burn|Frostbite":       { consume: ["Burn", "Frostbite"],           threshold: 3, produce: (n, p, m) => 1.2 * n * p * m },
  "Frostbite|Poison":     { consume: ["Frostbite", "Poison"],         threshold: 3, produce: (n, p, m) => 1.1 * n * p * m },
  // triple — its own option; most-specific, so it wins over any contained pair
  "Burn|Frostbite|Poison":{ consume: ["Burn", "Frostbite", "Poison"], threshold: 6, produce: (n, p, m) => 1.6 * n * p * m },
};

// --- the resolver under test. Selection order: most statuses consumed (specificity), then most
//     stacks, then lexical key. Specificity is PRIMARY; the lexical step is only a final
//     determinism backstop and never overrides a richer reaction.
function resolveReaction(target, registry) {
  const present = {};
  for (const e of target.activeEffects) present[e.source] = (present[e.source] || 0) + (e.stacks || 1);
  let best = null;
  for (const key of Object.keys(registry)) {
    const R = registry[key];
    if (!R.consume.every(src => present[src] != null)) continue;        // consume must be a subset of present
    let n = 0; for (const src of R.consume) n += present[src];
    if (n < R.threshold) continue;                                       // self-gates, like chainBurst
    const better =
      !best ||
      R.consume.length > best.R.consume.length ||                        // 1) most-specific
      (R.consume.length === best.R.consume.length && n > best.n) ||      // 2) most stacks
      (R.consume.length === best.R.consume.length && n === best.n && key < best.key); // 3) lexical backstop
    if (better) best = { key, R, n };
  }
  return best;
}

// --- greedy application: resolve ONE reaction, consume its statuses, return the payoff.
function applyReaction(target, registry, power = 1, mark = 1) {
  const best = resolveReaction(target, registry);
  if (!best) return { fired: false, produced: 0 };
  let consumedStacks = 0;
  for (const e of target.activeEffects) if (best.R.consume.includes(e.source)) consumedStacks += (e.stacks || 1);
  target.activeEffects = target.activeEffects.filter(e => !best.R.consume.includes(e.source)); // CONSUME
  const produced = best.R.produce(best.n, power, mark);
  return { fired: true, key: best.key, produced, consumedStacks, n: best.n };
}

// ----------------------------------------------------------------------------- harness
let pass = 0, fail = 0;
function ok(name, cond) { (cond ? (pass++, console.log("  ok   " + name)) : (fail++, console.log("  FAIL " + name))); }
function eff(list) { return { activeEffects: list.map(([source, stacks]) => ({ source, stacks })) }; }
// deterministic LCG so the fuzz is reproducible
let _s = 0x12345 >>> 0;
function rnd() { _s = (_s + 0x6D2B79F5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function shuffledRegistry() { // re-build REACTIONS with keys inserted in random order — proves order-independence
  const keys = Object.keys(REACTIONS).slice();
  for (let i = keys.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [keys[i], keys[j]] = [keys[j], keys[i]]; }
  const r = {}; for (const k of keys) r[k] = REACTIONS[k]; return r;
}

console.log("\nREACTION CONTRACT  (Phase 0 gate · ambient/greedy/most-specific)\n");

// 1) MOST-SPECIFIC: Burn+Poison+Frostbite present in winning quantities -> the TRIPLE wins, not a pair.
{
  const tgt = eff([["Burn", 3], ["Poison", 3], ["Frostbite", 2]]);
  const r = resolveReaction(tgt, REACTIONS);
  ok("triple beats any contained pair when all three present", r && r.key === "Burn|Frostbite|Poison");
}

// 2) DETERMINISM under registry key order: same winner no matter how entries are declared.
{
  const base = eff([["Burn", 3], ["Poison", 3], ["Frostbite", 2]]);
  const want = resolveReaction(base, REACTIONS).key;
  let stable = true;
  for (let i = 0; i < 200; i++) {
    const got = resolveReaction(eff([["Burn", 3], ["Poison", 3], ["Frostbite", 2]]), shuffledRegistry());
    if (!got || got.key !== want) { stable = false; break; }
  }
  ok("selection is independent of registry declaration order", stable);
}

// 3) SUBSET: only Burn+Poison present -> the Burn|Poison pair fires (triple needs Frostbite).
{
  const tgt = eff([["Burn", 3], ["Poison", 3]]);
  const r = resolveReaction(tgt, REACTIONS);
  ok("a pair fires when only that pair is present", r && r.key === "Burn|Poison");
}

// 4) THRESHOLD: a qualifying pattern below its stack threshold does NOT fire.
{
  const tgt = eff([["Burn", 1], ["Poison", 1]]);            // total 2 < Burn|Poison threshold 5, and < triple
  const r = resolveReaction(tgt, REACTIONS);
  ok("below-threshold pattern does not fire", r === null);
}

// 5) GREEDY (single reaction per swing): the triple fires once, consumes ALL three, and a
//    second resolve on the same swing finds nothing left -> no cascade.
{
  const tgt = eff([["Burn", 3], ["Poison", 3], ["Frostbite", 2]]);
  const first = applyReaction(tgt, REACTIONS);
  const second = resolveReaction(tgt, REACTIONS);
  ok("exactly one reaction resolves; consumed statuses are removed", first.fired && first.key === "Burn|Frostbite|Poison");
  ok("no leftover reaction re-fires on the same swing (greedy)", second === null && tgt.activeEffects.length === 0);
}

// 6) CONSERVATION (fuzzed): for every entry and random stack counts, the reaction REMOVES the
//    statuses it spends and its payoff is bounded by what it consumed. This is the structural
//    guard against amp-scaled-DoT feeding a power-scaled burst (the orderfuzz runaway class).
{
  let consumedAll = true, boundedAll = true, worst = 0;
  for (let i = 0; i < 5000; i++) {
    const b = Math.floor(rnd() * 8), p = Math.floor(rnd() * 8), f = Math.floor(rnd() * 8);
    const power = 1 + rnd() * 4, mark = 1 + rnd();          // upstream amps can have inflated power/mark
    const list = [];
    if (b) list.push(["Burn", b]); if (p) list.push(["Poison", p]); if (f) list.push(["Frostbite", f]);
    const tgt = eff(list);
    const res = applyReaction(tgt, REACTIONS, power, mark);
    if (!res.fired) continue;
    // structural: every consumed source is gone from the target
    const R = REACTIONS[res.key];
    if (tgt.activeEffects.some(e => R.consume.includes(e.source))) consumedAll = false;
    // magnitude: payoff bounded by stacks spent (normalised — power/mark are the chain's, not free DoT value).
    // The invariant we assert is that the reaction does not manufacture damage beyond CONS_FACTOR x the
    // stacks it removed, AT the chain power that produced them. produce() = k * n * power * mark, k <= CONS_FACTOR.
    const bound = CONS_FACTOR * res.consumedStacks * power * mark;
    const ratio = res.produced / (res.consumedStacks * power * mark || 1);
    if (res.produced > bound + 1e-9) boundedAll = false;
    if (ratio > worst) worst = ratio;
  }
  ok("every reaction consumes the statuses it reacts (no double-dip)", consumedAll);
  ok("payoff is bounded by stacks spent (<= CONS_FACTOR), worst k=" + worst.toFixed(2), boundedAll && worst <= CONS_FACTOR + 1e-9);
}

console.log("\n" + (fail ? "RESULT: FAIL (" + fail + " failed, " + pass + " passed)" : "RESULT: PASS (" + pass + " checks)") + "\n");
process.exit(fail ? 1 : 0);
