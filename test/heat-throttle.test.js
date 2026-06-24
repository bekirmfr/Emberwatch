/* heat-throttle.test.js — Heat as a LOAD-based, level-scaling build budget (Option 4 + risk).
   heat = sum of the chain's atom costs measured against heatCap = min(90, 30 + 2*(level-1)).
   Tight & early: ~2 atoms is the cool floor; 3 atoms run warm/hot from L3; 4 atoms hot by L5;
   a full stack ALWAYS redlines (permanent forced focus). Default it throttles power; Overdrive
   flips it to a boost; above 45% it burns HP while the chain is active.
   Usage: node heat-throttle.test.js <path-to-emberwatch.html> */
const { loadGame } = require('/home/claude/repo/test/simlib');
const api = loadGame(process.argv[2]);
api.startGame('ranger');
const G = api.getG(), h = G.hero;

let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? (pass++, console.log('  ok   ' + n)) : (fail++, console.log('  FAIL ' + n + (x ? '  -> ' + x : ''))); };
const at = (chain, level) => { h.chain = chain.slice(); G.level = level; return { f: api.heatFrac(h), thr: api.heatThrottle(h), burn: api.heatBurnFrac(h), cap: api.heatCap(h) }; };

const cool2   = ['ember', 'venom'];                                                          // the cool floor
const three   = ['ember', 'venom', 'overcharge'];                                            // 3 atoms
const four    = ['ember', 'venom', 'frostNail', 'overcharge'];                               // 4 atoms
const mid5     = ['ember', 'venom', 'overcharge', 'focus', 'momentum'];                       // 5
const stacked = ['ember', 'venom', 'overcharge', 'focus', 'momentum', 'fork', 'mark', 'frostNail', 'arc']; // 9

console.log('\nHEAT — load-based budget, cap = min(90, 30 + 2*(level-1))  (real emberwatch.html)\n');
ok('HEAT_COST covers every atom', Object.keys(api.ATOMS).every(id => typeof api.HEAT_COST[id] === 'number'));
ok('cap formula: L1=30, L3=34, L5=38, capped 90', api.heatCap((G.level = 1, h)) === 30 && api.heatCap((G.level = 3, h)) === 34 && api.heatCap((G.level = 5, h)) === 38 && api.heatCap((G.level = 99, h)) === 90);

// load-based + level-scaling basics
ok('heat scales with build load (stacked > cool floor)', at(stacked, 1).f > at(cool2, 1).f);
ok('same build runs cooler at higher level', at(stacked, 31).f < at(stacked, 1).f);

// the cool floor
{ const c = at(cool2, 1); ok('2 atoms @ L1 is the cool floor (no burn, near-full power)', c.burn === 0 && c.thr > 0.75, `thr=${c.thr.toFixed(2)} burn=${c.burn}`); }

// THE TARGETS: 3 atoms feel hot by L3, 4 atoms hot by L5
{ const r = at(three, 3); ok('3 atoms @ L3 run HOT (throttled + burning)', r.thr < 0.75 && r.burn > 0, `f=${(100*r.f).toFixed(0)}% thr=${r.thr.toFixed(2)} burn=${(100*r.burn).toFixed(1)}%`); }
{ const r = at(four, 5); ok('4 atoms @ L5 run HOT (throttled + burning)', r.thr < 0.70 && r.burn > 0, `f=${(100*r.f).toFixed(0)}% thr=${r.thr.toFixed(2)} burn=${(100*r.burn).toFixed(1)}%`); }

// full stack: permanent forced focus — redlines at every level
{ const e = at(stacked, 1), l = at(stacked, 31); ok('full stack redlines at L1', e.thr <= 0.55 && e.burn > 0); ok('full stack STILL redlines at the L31 cap (can never run everything)', l.burn > 0 && l.thr < 0.7, `thr=${l.thr.toFixed(2)} burn=${(100*l.burn).toFixed(1)}%`); }

// a mid build widens from unrunnable-early to comfortable very late
{ const e = at(mid5, 1), l = at(mid5, 31); ok('mid build WIDENS: hot early -> comfortable at the cap', e.burn > 0 && l.burn === 0, `L1burn=${(100*e.burn).toFixed(1)}% L31burn=${(100*l.burn).toFixed(1)}%`); }

// running hot also CHOKES healing — you can't sustain through an overload
ok('cool build heals at full (mult 1)', api.heatHealMult((h.chain = cool2.slice(), G.level = 20, h)) === 1);
ok('hot build heals less than full', api.heatHealMult((h.chain = mid5.slice(), G.level = 20, h)) < 1);
ok('deeper into the red chokes healing harder', api.heatHealMult((h.chain = mid5.slice(), G.level = 1, h)) < api.heatHealMult((h.chain = mid5.slice(), G.level = 20, h)));

// throttle direction + overload flip
{ ok('default: hot throttles below 1', at(stacked, 1).thr < 1); }
{ h.chain = stacked.concat('overdrive'); G.level = 1; ok('overdrive: hot BOOSTS above 1 (curve flipped)', api.heatThrottle(h) > 1, api.heatThrottle(h).toFixed(2)); }

// burn gate
ok('ventHeat decays the active-fire window', (h._heatActive = 1, api.ventHeat(h, 0.5), h._heatActive < 1 && h._heatActive >= 0));

console.log('\n' + (fail ? 'RESULT: FAIL (' + fail + ' failed)' : 'RESULT: PASS (' + pass + ' checks)') + '\n');
process.exit(fail ? 1 : 0);
