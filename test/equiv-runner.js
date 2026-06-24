/* equiv-runner.js — drive the REAL game's reaction atoms (Detonate/Rupture) over a battery of
   scenarios and print deterministic JSON. Run against original vs edited emberwatch.html; identical
   output == behavior-neutral refactor. Usage: node equiv-runner.js <path-to-emberwatch.html> */
const { loadGame } = require('/home/claude/repo/test/simlib');

const api = loadGame(process.argv[2]);
const ctx = api.getCtx();
api.startGame('ranger');
const h = api.getG().hero;
api.rebuild(h);

function freshDummy() {
  return { id: 'd', boss: false, dead: false, x: h.x, y: h.y - 30, r: 16,
    baseStats: api.mkStats({ armor: 0, maxHealth: 1e12 }), currentHealth: 1e12, _mhp: 1e12,
    sources: [], activeEffects: [], tags: ['enemy'] };
}
function seed(dummy, burnStacks, poisonStacks) {
  for (let i = 0; i < burnStacks; i++) api.applyEffectTemplate(dummy, api.burnTpl(7));   // dps value is irrelevant to the burst (burst scales on stack COUNT)
  for (let i = 0; i < poisonStacks; i++) api.applyEffectTemplate(dummy, api.poisonTpl(5));
}
function run(atomId, burnStacks, poisonStacks, power, mark) {
  const d = freshDummy();
  seed(d, burnStacks, poisonStacks);
  const hp0 = d.currentHealth;
  const s = { primary: d, targets: [d], power, mark, tags: new Set(), alive: true, dot: false, _burst: 0 };
  api.ATOMS[atomId].act(h, s);
  const burstDmg = +(hp0 - d.currentHealth).toFixed(6);
  const remaining = { Burn: 0, Poison: 0 };
  for (const e of d.activeEffects) if (remaining[e.source] != null) remaining[e.source]++;
  return { atomId, burnStacks, poisonStacks, power, mark, burstDmg, spent: s._burst, remaining };
}

const out = [];
for (const atom of ['detonate', 'rupture']) {
  for (const b of [0, 2, 4, 5, 8]) {
    for (const p of [0, 2, 4, 5, 8]) {
      for (const power of [1, 2.5]) {
        for (const mark of [1, 1.25]) {
          out.push(run(atom, b, p, power, mark));
        }
      }
    }
  }
}
console.log(JSON.stringify(out, null, 0));
