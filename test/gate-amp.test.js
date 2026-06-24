/* gate-amp.test.js — gates are conditional amplifiers: on a passing condition they ADD to s.power
   (boosting downstream producers + the reaction), on a failing one they halt (s.alive=false).
   Verified directly on the real ATOMS. Usage: node gate-amp.test.js <path-to-emberwatch.html> */
const { loadGame } = require('/home/claude/repo/test/simlib');
const api = loadGame(process.argv[2]);
const ctx = api.getCtx();
api.startGame('ranger');
const h = api.getG().hero;

let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? (pass++, console.log('  ok   ' + n)) : (fail++, console.log('  FAIL ' + n + (x ? '  -> ' + x : ''))); };
const foe = (hp, max, fx) => ({ dead: false, currentHealth: hp, _mhp: max, baseStats: api.mkStats({ maxHealth: max }), activeEffects: fx || [], x: 0, y: 0, r: 16, sources: [] });
const mkS = prim => ({ crit: false, power: 1, mark: 1, targets: [prim], primary: prim, tags: new Set(), alive: true });
const run = (id, prim, tweak) => { const s = mkS(prim); if (tweak) tweak(s); api.ATOMS[id].act(h, s); return s; };

console.log('\nGATES AS CONDITIONAL AMPLIFIERS  (real emberwatch.html)\n');
const G = api.GATE_BONUS;
ok('GATE_BONUS table exposes all five gates', G && ['onCrit', 'execute', 'kindling', 'everyThird', 'exploit'].every(k => typeof G[k] === 'number'));

// onCrit
{ const p = run('onCrit', foe(100, 100), s => s.crit = true); ok('onCrit PASS: power += bonus, chain alive', Math.abs(p.power - (1 + G.onCrit)) < 1e-9 && p.alive, 'pow=' + p.power); }
{ const f = run('onCrit', foe(100, 100), s => s.crit = false); ok('onCrit FAIL: halts, power unchanged', !f.alive && f.power === 1); }
// execute (foe <30% HP)
{ const p = run('execute', foe(20, 100)); ok('execute PASS (<30% HP): power += bonus', Math.abs(p.power - (1 + G.execute)) < 1e-9 && p.alive); }
{ const f = run('execute', foe(80, 100)); ok('execute FAIL (healthy foe): halts', !f.alive && f.power === 1); }
// kindling (foe burning)
{ const p = run('kindling', foe(100, 100, [{ source: 'Burn' }])); ok('kindling PASS (burning): power += bonus', Math.abs(p.power - (1 + G.kindling)) < 1e-9 && p.alive); }
{ const f = run('kindling', foe(100, 100, [])); ok('kindling FAIL (not burning): halts', !f.alive && f.power === 1); }
// everyThird (h._chainAtk % 3 === 0)
{ h._chainAtk = 3; const p = run('everyThird', foe(100, 100)); ok('everyThird PASS (3rd swing): power += bonus', Math.abs(p.power - (1 + G.everyThird)) < 1e-9 && p.alive); }
{ h._chainAtk = 1; const f = run('everyThird', foe(100, 100)); ok('everyThird FAIL (off-beat): halts', !f.alive && f.power === 1); }
// exploit (2+ statuses)
{ const p = run('exploit', foe(100, 100, [{ source: 'Burn' }, { source: 'Poison' }])); ok('exploit PASS (2+ statuses): power += bonus', Math.abs(p.power - (1 + G.exploit)) < 1e-9 && p.alive); }
{ const f = run('exploit', foe(100, 100, [{ source: 'Burn' }])); ok('exploit FAIL (<2 statuses): halts', !f.alive && f.power === 1); }
// stun re-homed to utility (does not gate)
ok('stun is now utility, not a gate', api.ATOMS.stun.role === 'util');
{ const s = run('stun', foe(100, 100)); ok('stun never halts the chain', s.alive && s.power === 1); }

console.log('\n' + (fail ? 'RESULT: FAIL (' + fail + ' failed)' : 'RESULT: PASS (' + pass + ' checks)') + '\n');
process.exit(fail ? 1 : 0);
