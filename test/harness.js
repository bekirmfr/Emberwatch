/* =========================================================================
   Emberwatch — headless test harness
   -------------------------------------------------------------------------
   Extracts the <script> from emberwatch.html, stubs a browser environment
   (canvas, WebAudio, DOM, localStorage, timers), evals the game in that
   sandbox, and runs the loop without a display. Reports "ALL OK" if no
   uncaught exception is thrown.

   Run:  node test/harness.js

   GOTCHAS (learned the hard way — read before editing):
   - Game functions are eval-scoped, NOT global. Put assertions INSIDE the
     eval string (here: the `test` array), not after the eval call.
   - Build the eval'd test code by joining an array of single-quoted strings,
     NOT a template literal. The game source contains template literals and
     wrapping it in backticks corrupts parsing ("Unexpected end of input").
   - Node 18+ ships a NATIVE read-only `navigator` with no `sendBeacon`. It
     shadows any global.navigator you assign for *bare* `navigator` lookups
     inside the eval. To test telemetry, exercise the fetch() fallback path
     (spy on global.fetch) rather than sendBeacon.
   - "died true" is not a crash. Only an ERROR-printed uncaught exception is.
   - Stub setTimeout as non-recursing to avoid infinite scheduler loops
     (e.g. the fire crackle scheduler).
   ========================================================================= */
const fs = require('fs');
const path = require('path');

const HTML = path.join(__dirname, '..', 'emberwatch.html');
const code = [...fs.readFileSync(HTML, "utf8")
  .matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x => x[1]).join("\n");

const noop = () => {};
const grad = { addColorStop: noop };
const ctx2d = new Proxy({}, {
  get: (t, p) => String(p).includes("Gradient") ? () => grad : () => undefined,
  set: () => true
});
function fakeEl() {
  const o = {
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    style: { setProperty: noop }, dataset: {},
    addEventListener: noop, appendChild: noop,
    querySelector: () => fakeEl(), querySelectorAll: () => [],
    onclick: null, offsetWidth: 0, getContext: () => ctx2d, width: 0, height: 0
  };
  Object.defineProperty(o, "innerHTML", { get() { return ""; }, set() {} });
  Object.defineProperty(o, "textContent", { get() { return ""; }, set() {} });
  return o;
}
function FakeParam() {
  return { setValueAtTime: noop, exponentialRampToValueAtTime: noop,
    linearRampToValueAtTime: noop, setTargetAtTime: noop,
    cancelScheduledValues: noop, value: 0 };
}
global.window = global;
global.window.AudioContext = function () {
  return {
    currentTime: 0, sampleRate: 44100, destination: {},
    createOscillator: () => ({ type: "", frequency: FakeParam(), connect: noop, start: noop, stop: noop }),
    createGain: () => ({ gain: FakeParam(), connect: noop }),
    createBiquadFilter: () => ({ type: "", frequency: FakeParam(), Q: FakeParam(), connect: noop }),
    createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }),
    createBufferSource: () => ({ buffer: null, loop: false, connect: noop, start: noop, stop: noop }),
    createDynamicsCompressor: () => ({ connect: noop, threshold: FakeParam(), knee: FakeParam(),
      ratio: FakeParam(), attack: FakeParam(), release: FakeParam() }),
    resume: noop
  };
};
global.devicePixelRatio = 1;
global.innerWidth = 900;
global.innerHeight = 600;
global.addEventListener = noop;
global.requestAnimationFrame = noop;
global.setTimeout = () => 0;          // non-recursing
global.clearTimeout = noop;
global.matchMedia = () => ({ matches: false });
let T = 0;
global.performance = { now: () => T };

// localStorage shim so the meta-store uses its persistent path
const _ls = {};
global.window.localStorage = {
  getItem: k => (k in _ls ? _ls[k] : null),
  setItem: (k, v) => { _ls[k] = String(v); },
  removeItem: k => { delete _ls[k]; }
};

// telemetry: spy on the fetch fallback (see GOTCHAS re: navigator.sendBeacon)
global.__fetches = [];
global.fetch = (url, opts) => { global.__fetches.push({ url, body: opts && opts.body }); return Promise.resolve({}); };

global.document = {
  getElementById: () => fakeEl(),
  createElement: () => fakeEl(),
  querySelector: () => fakeEl()
};

// ---- Default smoke test. Extend the array to assert on specific systems. ----
const test = [
  'startGame("ranger"); buildHotbar();',
  'function frame(){ T += 1000/60; G.paused = false; update(1/60); render(); }',
  'for (let i = 0; i < 300; i++) frame();',   // ~5 simulated seconds
  'console.log("frames: 300, wave " + G.wave + ", level " + G.level + ", dead " + G.hero.dead);',
  'console.log("loop ok");'
].join("\n");

let err = null;
try {
  eval(code + "\n" + test);
} catch (e) {
  err = e;
}
console.log(err
  ? ("ERROR: " + err.message + "\n" + (err.stack || "").split("\n").slice(0, 4).join("\n"))
  : "ALL OK");
process.exit(err ? 1 : 0);
