import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the production controller with a fake browser clock and shader loader.
const source = fs.readFileSync(new URL('../modules/background-gradient.js', import.meta.url), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function target(properties = {}) {
  const listeners = new Map();
  return {
    ...properties,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    emit(type, event = {}) { for (const listener of [...listeners.get(type) ?? []]) listener(event); },
    count(type) { return listeners.get(type)?.size ?? 0; }
  };
}

function browser({ gpu = true, reduced = false, hidden = false, loadError, pendingLoad, pendingShader,
  earlyError = false, earlyReady = true, throwMethod } = {}) {
  let now = 0, nextId = 0, imports = 0;
  const frames = new Map(), timers = new Map(), instances = [], callbacks = [];
  const motion = target({ matches: reduced });
  const window = target({ matchMedia: () => motion });
  const document = target({ hidden, documentElement: { dataset: {} }, createElement: () => ({ style: {} }) });
  const classes = new Set();
  const host = {
    dataset: {}, children: [],
    classList: { toggle(name, active) { if (active) classes.add(name); else classes.delete(name); } },
    replaceChildren(...children) { this.children = children; }
  };
  function makeInstance() {
    const calls = { update: 0, pause: 0, resume: 0, destroy: 0 };
    const instance = { calls, failure: null, updates: [], getFailureReason() { return this.failure; } };
    for (const method of Object.keys(calls)) instance[method] = (...args) => {
      calls[method]++;
      if (method === 'update') instance.updates.push(args[1]);
      if (throwMethod === method || instance.throwMethod === method) throw new Error(`${method} failed`);
    };
    instances.push(instance);
    return instance;
  }
  const library = { createShader: async (canvas, definition, options) => {
    const instance = makeInstance();
    callbacks.push(options);
    if (earlyError) options.onError();
    else if (earlyReady) options.onReady();
    if (pendingShader) await pendingShader.promise;
    return instance;
  } };
  const create = vm.runInNewContext(`${source.replace(/^export /m, '')}\ncreateBackgroundGradient;`, {
    window, document, navigator: gpu ? { gpu: {} } : {}, performance: { now: () => now },
    requestAnimationFrame(callback) { const id = ++nextId; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(callback, delay) { const id = ++nextId; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); }
  });
  const controller = create(host, async () => {
    imports++;
    if (loadError) throw new Error('shader load failed');
    if (pendingLoad) await pendingLoad.promise;
    return library;
  });
  function tick(ms) {
    now += ms;
    for (const [id, timer] of [...timers]) if (timers.has(id) && timer.at <= now) {
      timers.delete(id); timer.callback();
    }
    const batch = [...frames];
    for (const [id, callback] of batch) if (frames.has(id)) { frames.delete(id); callback(now); }
  }
  function advance(ms, frameMs = 1000 / 60) {
    const until = now + ms;
    while (now < until) tick(Math.min(frameMs, until - now));
  }
  return {
    controller, host, classes, window, document, motion, frames, timers, instances, callbacks,
    get imports() { return imports; }, tick, advance,
    changeMotion(matches) { motion.matches = matches; motion.emit('change'); },
    visibility(hidden) { document.hidden = hidden; document.emit('visibilitychange'); },
    error(reason = null) { instances.at(-1).failure = reason; callbacks.at(-1).onError(); },
    ready() { callbacks.at(-1).onReady(); }
  };
}

function cleaned(env) {
  assert.equal(env.host.children.length, 0);
  assert.equal(env.frames.size, 0);
  assert.equal(env.timers.size, 0);
  assert.equal(env.document.count('visibilitychange'), 0);
}

test('unsupported WebGPU and reduced motion keep CSS without importing the engine', async () => {
  for (const options of [{ gpu: false }, { reduced: true }]) {
    const env = browser(options);
    env.controller.mount(); await flush();
    assert.equal(env.imports, 0);
    assert.equal(env.host.dataset.state, options.reduced ? 'static' : 'fallback');
    env.controller.setEmphasis(true);
    assert(env.classes.has('is-emphasized'));
    env.controller.updateTheme();
    cleaned(env);
  }
});

test('module loading failure clears all work and stays downgraded across lifecycle changes', async () => {
  const env = browser({ loadError: true });
  env.controller.mount(); await flush();
  assert.equal(env.host.dataset.state, 'fallback'); cleaned(env);
  env.changeMotion(true); env.changeMotion(false);
  env.window.emit('pagehide'); env.window.emit('pageshow', { persisted: true });
  await flush();
  assert.equal(env.imports, 1);
  assert.equal(env.host.dataset.state, 'fallback'); cleaned(env);
});

test('an error before createShader resolves destroys its late instance and ignores late ready', async () => {
  const pending = deferred();
  const env = browser({ earlyError: true, pendingShader: pending });
  env.controller.mount(); await flush();
  assert.equal(env.host.dataset.state, 'fallback'); cleaned(env);
  pending.resolve(); await flush();
  assert.equal(env.instances[0].calls.destroy, 1);
  env.ready();
  assert.equal(env.host.dataset.state, 'fallback'); cleaned(env);
});

test('a rejected shader initialization is cleaned without an unhandled rejection', async () => {
  const pending = deferred();
  const env = browser({ pendingShader: pending, earlyReady: false });
  env.controller.mount(); await flush();
  pending.reject(new Error('adapter/device unavailable')); await flush();
  assert.equal(env.host.dataset.reason, 'initialization-failed'); cleaned(env);
});

test('terminal runtime errors destroy the instance and cancel hover and monitoring frames', async () => {
  const env = browser();
  env.controller.mount(); await flush();
  env.controller.setEmphasis(true);
  assert.equal(env.frames.size, 2);
  env.error('render-failed');
  assert.equal(env.instances[0].calls.destroy, 1);
  assert.equal(env.host.dataset.state, 'fallback'); cleaned(env);
  const updates = env.instances[0].calls.update;
  env.controller.updateTheme(); env.controller.setEmphasis(false); env.ready(); env.advance(20000);
  assert.equal(env.instances[0].calls.update, updates);
  assert.equal(env.host.dataset.state, 'fallback'); cleaned(env);
});

test('device loss displays CSS during rebuilding and resumes with the latest theme and emphasis', async () => {
  const env = browser();
  env.controller.mount(); await flush();
  env.controller.setEmphasis(true);
  env.error();
  assert.equal(env.host.dataset.state, 'recovering');
  assert.equal(env.frames.size, 0);
  const instance = env.instances[0];
  const { update, pause, resume } = instance.calls;
  env.controller.setEmphasis(false);
  env.document.documentElement.dataset.theme = 'dark'; env.controller.updateTheme();
  env.visibility(true); env.visibility(false);
  assert.equal(instance.calls.update, update);
  assert.equal(instance.calls.pause, pause);
  assert.equal(instance.calls.resume, resume);
  env.ready();
  assert.equal(env.host.dataset.state, 'ready');
  assert.equal(instance.calls.destroy, 0);
  assert(instance.calls.resume > resume);
  assert.equal(instance.updates.at(-1).colorA, '#111d31');
  assert.equal(instance.updates.at(-1).speed, 0.6);
  assert.equal(env.frames.size, 1);
  assert.equal(env.timers.size, 0);
});

test('unsuccessful device rebuilding falls back permanently', async () => {
  const env = browser(); env.controller.mount(); await flush();
  env.error(); env.error('rebuild_failed');
  assert.equal(env.host.dataset.state, 'fallback');
  assert.equal(env.instances[0].calls.destroy, 1); cleaned(env);
});

test('loading, first-frame and device-recovery deadlines release late or stalled instances', async () => {
  const pending = deferred();
  const loading = browser({ pendingLoad: pending }); loading.controller.mount(); await flush();
  loading.advance(10000);
  assert.equal(loading.host.dataset.reason, 'initialization-timeout'); cleaned(loading);
  pending.resolve(); await flush();
  assert.equal(loading.instances.length, 0);

  const creating = deferred();
  const late = browser({ pendingShader: creating, earlyReady: false }); late.controller.mount(); await flush();
  late.advance(10000); creating.resolve(); await flush();
  assert.equal(late.instances[0].calls.destroy, 1); cleaned(late);

  const noFrame = browser({ earlyReady: false }); noFrame.controller.mount(); await flush();
  noFrame.advance(10000);
  assert.equal(noFrame.instances[0].calls.destroy, 1); cleaned(noFrame);

  const recovery = browser(); recovery.controller.mount(); await flush(); recovery.error();
  recovery.advance(10000);
  assert.equal(recovery.host.dataset.reason, 'recovery-timeout');
  assert.equal(recovery.instances[0].calls.destroy, 1);
  recovery.ready(); assert.equal(recovery.host.dataset.state, 'fallback'); cleaned(recovery);
});

test('hidden pages do not expire loading or recovery deadlines', async () => {
  const env = browser({ earlyReady: false, hidden: true }); env.controller.mount(); await flush();
  env.advance(60000); assert.equal(env.host.dataset.state, 'loading');
  env.visibility(false); env.advance(5000); env.ready();
  assert.equal(env.host.dataset.state, 'ready');
  env.error(); env.visibility(true); env.advance(60000);
  assert.equal(env.host.dataset.state, 'recovering');
  env.ready(); assert.equal(env.host.dataset.state, 'ready');
  assert.equal(env.frames.size, 0);
  env.visibility(false); assert.equal(env.frames.size, 1);
});

test('sustained visible-page cadence below 24fps downgrades after warmup', async () => {
  const env = browser(); env.controller.mount(); await flush();
  env.advance(8500, 100);
  assert.equal(env.host.dataset.state, 'ready');
  env.advance(1000, 100);
  assert.equal(env.host.dataset.reason, 'low-frame-rate');
  assert.equal(env.instances[0].calls.destroy, 1); cleaned(env);
});

test('healthy 30/60fps, startup work, isolated stalls and background time do not downgrade', async () => {
  for (const cadence of [1000 / 30, 1000 / 60]) {
    const env = browser(); env.controller.mount(); await flush();
    env.advance(2500, 200); env.advance(10000, cadence);
    env.tick(2500); env.advance(10000, cadence);
    assert.equal(env.host.dataset.state, 'ready');
    env.visibility(true); assert.equal(env.frames.size, 0); env.advance(60000, 1000);
    env.visibility(false); env.advance(10000, cadence);
    assert.equal(env.host.dataset.state, 'ready');
    env.window.emit('pagehide'); cleaned(env);
  }
});

test('healthy frames between slow windows reset the low-performance streak', async () => {
  const env = browser(); env.controller.mount(); await flush();
  env.advance(7100, 100); env.advance(4000); env.advance(4000, 100);
  assert.equal(env.host.dataset.state, 'ready');
});

test('theme, hover and pause/resume exceptions fall back safely', async () => {
  for (const method of ['update', 'pause', 'resume']) {
    const env = browser(); env.controller.mount(); await flush();
    env.instances[0].throwMethod = method;
    if (method === 'update') env.controller.updateTheme();
    else env.visibility(method === 'pause');
    assert.equal(env.host.dataset.state, 'fallback'); cleaned(env);
    assert.equal(env.instances[0].calls.destroy, 1);
  }
  const hover = browser(); hover.controller.mount(); await flush();
  hover.instances[0].throwMethod = 'update'; hover.controller.setEmphasis(true); hover.tick(16);
  assert.equal(hover.host.dataset.state, 'fallback'); cleaned(hover);
});

test('destroy exceptions do not interrupt CSS fallback or cleanup', async () => {
  const env = browser({ throwMethod: 'destroy' }); env.controller.mount(); await flush();
  env.error('gpu-error');
  assert.equal(env.host.dataset.state, 'fallback'); cleaned(env);
});

test('motion changes and bfcache restore ignore pending old initialization', async () => {
  const pending = deferred();
  const env = browser({ pendingShader: pending }); env.controller.mount(); await flush();
  env.changeMotion(true); cleaned(env);
  env.changeMotion(false); await flush();
  pending.resolve(); await flush();
  assert.equal(env.instances[0].calls.destroy, 1);
  assert.equal(env.instances[1].calls.destroy, 0);
  env.callbacks[0].onError(); env.callbacks[0].onReady();
  assert.equal(env.host.dataset.state, 'ready');
  env.window.emit('pagehide'); cleaned(env);
  assert.equal(env.instances[1].calls.destroy, 1);
  env.window.emit('pageshow', { persisted: true }); await flush();
  assert.equal(env.host.dataset.state, 'ready');
  assert.equal(env.instances.length, 3);
  assert.equal(env.document.count('visibilitychange'), 1);
  env.controller.mount(); await flush(); assert.equal(env.instances.length, 3);
});
