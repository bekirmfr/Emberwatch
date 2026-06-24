/* simlib.js — shared headless environment + game loader for balance tooling.
   Evals emberwatch.html's <script> in a stubbed browser env and hands back live
   references to the REAL game functions, so tools drive the actual combat pipeline
   (resolveAttack / basicInstance / tickActor / resolveStat / the trigger bus + guard). */
const fs = require('fs');
const path = require('path');

function installEnv() {
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
      style: new Proxy({}, { get: (t, p) => (p === "setProperty" || p === "removeProperty") ? noop : (p === "getPropertyValue" ? () => "" : (t[p] || "")), set: (t, p, v) => { t[p] = v; return true; } }),
      dataset: {}, width: 800, height: 600, value: "", textContent: "", innerHTML: "",
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
  global.localStorage = { getItem: k => (k in _ls ? _ls[k] : null), setItem: (k, v) => { _ls[k] = String(v); }, removeItem: k => { delete _ls[k]; } };
  global.__fetches = [];
  global.fetch = (url, opts) => { global.__fetches.push({ url, body: opts && opts.body }); return Promise.resolve({}); };
  global.requestAnimationFrame = noop; global.cancelAnimationFrame = noop;
  global.setTimeout = () => 0; global.clearTimeout = noop; global.setInterval = () => 0; global.clearInterval = noop;
  global.devicePixelRatio = 1; global.innerWidth = 800; global.innerHeight = 600;
  global.matchMedia = () => ({ matches: false, addEventListener: noop, addListener: noop });
  global.addEventListener = noop; global.removeEventListener = noop;
  global.getComputedStyle = () => new Proxy({}, { get: () => "" });
  global.alert = noop; global.prompt = () => null; global.confirm = () => false;
  function param() { return { value: 0, setValueAtTime: noop, linearRampToValueAtTime: noop, exponentialRampToValueAtTime: noop, cancelScheduledValues: noop, setTargetAtTime: noop, setValueCurveAtTime: noop }; }
  function audioNode() {
    return new Proxy({ gain: param(), frequency: param(), detune: param(), Q: param(), pan: param(), playbackRate: param(), type: "", buffer: null, connect: () => audioNode(), disconnect: noop, start: noop, stop: noop }, { get: (t, p) => (p in t ? t[p] : noop) });
  }
  const Audio = function () {
    return new Proxy({
      createOscillator: audioNode, createGain: audioNode, createBiquadFilter: audioNode, createBufferSource: audioNode,
      createDynamicsCompressor: audioNode, createWaveShaper: audioNode, createStereoPanner: audioNode, createConvolver: audioNode,
      createAnalyser: audioNode, createDelay: audioNode, createBuffer: () => ({ getChannelData: () => new Float32Array(1) }),
      decodeAudioData: () => Promise.resolve({}), resume: () => Promise.resolve(), destination: {}, currentTime: 0, sampleRate: 44100, state: "running", listener: {}
    }, { get: (t, p) => (p in t ? t[p] : noop) });
  };
  global.AudioContext = Audio; global.webkitAudioContext = Audio;
  global.document = { getElementById: () => fakeEl(), createElement: () => fakeEl(), createElementNS: () => fakeEl(), querySelector: () => fakeEl(), querySelectorAll: () => [], addEventListener: noop, removeEventListener: noop, body: fakeEl(), documentElement: fakeEl() };
  global.window = { localStorage: global.localStorage, requestAnimationFrame: noop, cancelAnimationFrame: noop, addEventListener: noop, removeEventListener: noop, matchMedia: global.matchMedia, devicePixelRatio: 1, innerWidth: 800, innerHeight: 600, AudioContext: Audio, webkitAudioContext: Audio, setTimeout: global.setTimeout, clearTimeout: noop, fetch: global.fetch, location: { href: "", search: "" }, navigator: { maxTouchPoints: 0, userAgent: "node" } };
}

/* Eval the game and capture live references to the real functions we need. */
function loadGame(htmlPath) {
  installEnv();
  const HTML = htmlPath || path.join(__dirname, '..', 'emberwatch.html');
  const code = [...fs.readFileSync(HTML, "utf8").matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x => x[1]).join("\n");
  const api = {};
  const grab = '\n;Object.assign(api, { startGame, buildHotbar, resolveStat, resolveAttack, basicInstance, tickActor, rebuild, rollItem, PERKS, mkStats, ITEM_BASES, ENEMIES, ENEMY_AFFIXES, seedRun, grng, dailySeed, startWave, spawnEnemy, rollEnemyLoot, resolveAll, sourcesWith, BURN, POISON, chillTpl, burnTpl, poisonTpl, applyEffectTemplate, runChain, runReactions, REACTIONS, ATOMS, GATE_BONUS, ATOM_CARD_POOL, chainShape, shapeText, SHAPE_I18N, chainSlotCount, autoFillChain, grantChainAtom, atomOfferFor, ATOM_PRODUCERS, chainMove, chainUnslot, chainSlot, chainDrop, ATOM_BOSS_POOL, killEnemy, getG: () => G, getCtx: () => ctx });';
  eval(code + grab);
  return api;
}

/* Deterministic RNG control so every loadout faces identical draws. */
let _origRandom = null;
function seedRandom(seed) {
  if (!_origRandom) _origRandom = Math.random;
  let s = seed >>> 0;
  Math.random = function () {                       // mulberry32
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function restoreRandom() { if (_origRandom) { Math.random = _origRandom; _origRandom = null; } }

module.exports = { loadGame, seedRandom, restoreRandom };
