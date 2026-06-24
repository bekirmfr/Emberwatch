/* reaction-live.test.js — verify the EMERGENT reactions on the real game. Each combination must run a
   DISTINCT verb: Detonate (single-target), Shatter (AoE), Blight (contagion), Cataclysm (apex).
   Plus resolver properties: most-specific wins, greedy, threshold, consume. Usage: node reaction-live.test.js <path> */
const { loadGame } = require('/home/claude/repo/test/simlib');

const api = loadGame(process.argv[2]);
const ctx = api.getCtx();
api.startGame('ranger');
const G = api.getG();
const h = G.hero; api.rebuild(h);

let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? (pass++, console.log('  ok   ' + n)) : (fail++, console.log('  FAIL ' + n + (x ? '  -> ' + x : ''))); };

function foe(x, hp) { return { id: 'e' + x, dead: false, x, y: 0, r: 16, baseStats: api.mkStats({ armor: 0, maxHealth: hp || 1e9 }), currentHealth: hp || 1e9, _mhp: hp || 1e9, sources: [], activeEffects: [], tags: ['enemy'] }; }
function poisonCount(d) { return d.activeEffects.filter(e => e.source === 'Poison').length; }
function burnCount(d) { return d.activeEffects.filter(e => e.source === 'Burn').length; }
// build a primary at x=0 with given stacks + 3 neighbours within 90px; fire one reaction pass
function fire(b, p, f) {
  const prim = foe(0); const nb = [foe(20), foe(40), foe(60)];
  for (let i = 0; i < b; i++) api.applyEffectTemplate(prim, api.burnTpl(7));
  for (let i = 0; i < p; i++) api.applyEffectTemplate(prim, api.poisonTpl(5));
  for (let i = 0; i < f; i++) api.applyEffectTemplate(prim, api.chillTpl(0.3));
  G.enemies = [prim, ...nb];
  const hp0 = nb.map(d => d.currentHealth);
  const s = { primary: prim, targets: [prim], power: 1, mark: 1, tags: new Set(), alive: true, _burst: 0, _reactKey: null };
  api.runReactions(h, s);
  return { key: s._reactKey, prim, nb, nbDmg: nb.map((d, i) => hp0[i] - d.currentHealth), present: { Burn: burnCount(prim), Poison: poisonCount(prim), Frostbite: prim.activeEffects.filter(e => e.source === 'Frostbite').length } };
}

console.log('\nEMERGENT REACTIONS  (real emberwatch.html)\n');

// retirement intact
ok('Detonate/Rupture atoms still retired', api.ATOMS.detonate === undefined && api.ATOMS.rupture === undefined);
ok('single-Poison reaction dropped (combination-only)', !api.REACTIONS['Poison']);
ok('three combination reactions + triple present', !!api.REACTIONS['Burn|Poison'] && !!api.REACTIONS['Burn|Frostbite'] && !!api.REACTIONS['Frostbite|Poison'] && !!api.REACTIONS['Burn|Frostbite|Poison']);

// DISTINCT VERBS
{ const r = fire(3, 3, 0); ok('Burn+Poison = DETONATE: single-target (neighbours untouched)', r.key === 'Burn|Poison' && r.nbDmg.every(d => d === 0), JSON.stringify(r.nbDmg)); }
{ const r = fire(3, 0, 1); ok('Burn+Frostbite = SHATTER: AoE (neighbours take damage)', r.key === 'Burn|Frostbite' && r.nbDmg.some(d => d > 0), JSON.stringify(r.nbDmg)); }
{ const r = fire(0, 4, 1); const spread = r.nb.some(d => poisonCount(d) > 0); ok('Frostbite+Poison = BLIGHT: contagion (neighbours gain poison)', r.key === 'Frostbite|Poison' && spread, 'spread=' + spread); }
{ const r = fire(3, 3, 1); const dmg = r.nbDmg.some(d => d > 0); const seeded = r.nb.some(d => burnCount(d) > 0 && poisonCount(d) > 0); ok('triple = CATACLYSM: AoE + reseeds burn/poison on neighbours', r.key === 'Burn|Frostbite|Poison' && dmg && seeded, 'dmg=' + dmg + ' seeded=' + seeded); }

// resolver properties
{ const r = fire(3, 3, 1); ok('most-specific: all three present → triple wins & consumes all', r.key === 'Burn|Frostbite|Poison' && r.present.Burn === 0 && r.present.Poison === 0 && r.present.Frostbite === 0); }
{ const r = fire(1, 1, 0); ok('below threshold → no reaction', r.key === null); }
{ const prim = foe(0), nb = [foe(20)]; for (let i = 0; i < 3; i++) api.applyEffectTemplate(prim, api.burnTpl(7)); for (let i = 0; i < 3; i++) api.applyEffectTemplate(prim, api.poisonTpl(5)); api.applyEffectTemplate(prim, api.chillTpl(0.3)); G.enemies = [prim, ...nb];
  const s1 = { primary: prim, targets: [prim], power: 1, mark: 1, tags: new Set(), alive: true, _burst: 0, _reactKey: null }; api.runReactions(h, s1);
  const s2 = { primary: prim, targets: [prim], power: 1, mark: 1, tags: new Set(), alive: true, _burst: 0, _reactKey: null }; api.runReactions(h, s2);
  ok('greedy: one reaction per swing (2nd pass finds nothing)', s1._reactKey === 'Burn|Frostbite|Poison' && s2._reactKey === null, s1._reactKey + ' / ' + s2._reactKey); }

console.log('\n' + (fail ? 'RESULT: FAIL (' + fail + ' failed)' : 'RESULT: PASS (' + pass + ' checks)') + '\n');
process.exit(fail ? 1 : 0);
