/* shape-readout.test.js — verify the reaction-aware shape classifier + localization on the real game.
   chainShape names a build by its REACTION PAYOFF (which emergent verb its producers can trigger),
   falling back to role shape when <2 producers are slotted. shapeText localizes via SHAPE_I18N.
   Pure display — touches no combat. Usage: node shape-readout.test.js <path-to-emberwatch.html> */
const { loadGame } = require('/home/claude/repo/test/simlib');

const api = loadGame(process.argv[2]);
api.startGame('ranger');
const h = api.getG().hero;

let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? (pass++, console.log('  ok   ' + n)) : (fail++, console.log('  FAIL ' + n + (x ? '  -> ' + x : ''))); };
const shape = chain => { h.chain = chain; return api.chainShape(h); };

console.log('\nSHAPE READOUT — reaction-aware  (real emberwatch.html)\n');

// --- reaction identity: named by the richest reaction the producers can trigger ---
ok('all three producers -> cataclysm', shape(['ember', 'venom', 'frostNail', 'momentum']) === 'cataclysm', shape(['ember', 'venom', 'frostNail']));
ok('ember+venom -> detonator', shape(['ember', 'venom', 'momentum']) === 'detonator', shape(['ember', 'venom']));
ok('ember+frostNail -> shatter', shape(['ember', 'frostNail', 'overcharge']) === 'shatter', shape(['ember', 'frostNail']));
ok('frostNail+venom -> blight', shape(['frostNail', 'venom', 'focus']) === 'blight', shape(['frostNail', 'venom']));
ok('reaction identity beats role: 3 producers + distributors still cataclysm', shape(['ember', 'venom', 'frostNail', 'fork', 'spread', 'arc']) === 'cataclysm');

// --- role fallback when <2 reaction-producers ---
ok('one producer + distributors -> spreader (role)', shape(['ember', 'fork', 'spread', 'arc']) === 'spreader');
ok('no producers, distributors -> spreader (role)', shape(['fork', 'spread', 'arc']) === 'spreader');
ok('searing is NOT a reaction-producer -> burst (role)', shape(['onCrit', 'focus', 'searing']) === 'burst');
ok('no signature atoms -> unfocused', shape(['overcharge', 'mark', 'leech']) === 'unfocused');
ok('empty chain -> unfocused', shape([]) === 'unfocused');
ok('retired ids ignored (no crash)', !!shape(['detonate', 'ember', 'venom']));
ok('classification is display-only (chain unchanged)', (shape(['ember', 'venom']), h.chain.length === 2));

// --- localization plumbing ---
const KEYS = ['cataclysm', 'detonator', 'shatter', 'blight', 'stacker', 'spreader', 'burst', 'hybrid', 'unfocused'];
const LANGS = Object.keys(api.SHAPE_I18N);
ok('shapeText resolves to [name, desc] strings', (() => { const t = api.shapeText('cataclysm'); return Array.isArray(t) && t.length === 2 && t[0] && t[1]; })());
ok('all 8 expected languages present', LANGS.length === 8 && ['en', 'tr', 'zh', 'es', 'fr', 'ru', 'ja', 'ar'].every(l => LANGS.includes(l)), LANGS.join(','));
let complete = true, missing = '';
for (const lang of LANGS) for (const k of KEYS) {
  const e = api.SHAPE_I18N[lang][k];
  if (!Array.isArray(e) || !e[0] || !e[1]) { complete = false; missing += ' ' + lang + '/' + k; }
}
ok('every language has all 9 shapes with name+desc', complete, missing);

console.log('\n' + (fail ? 'RESULT: FAIL (' + fail + ' failed)' : 'RESULT: PASS (' + pass + ' checks)') + '\n');
process.exit(fail ? 1 : 0);
