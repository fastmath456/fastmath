import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function load(file, modules = {}, globals = {}) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync('src/features/admin-guide/' + file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, ...globals, require(name) {
    if (name.endsWith('.css')) return {};
    if (name in modules) return modules[name];
    throw new Error(name);
  } });
  return exports;
}

function runtime({ desktop = true, storage = new Map(), blockedStorage = false, targets = true } = {}) {
  const mediaListeners = new Set(), frames = new Map(), runs = [];
  let nextFrame = 0, effect, cleanup;
  const media = { matches: desktop, addEventListener: (_name, fn) => mediaListeners.add(fn), removeEventListener: (_name, fn) => mediaListeners.delete(fn) };
  const window = { matchMedia: () => media, localStorage: {
    getItem(key) { if (blockedStorage) throw new Error('blocked'); return storage.get(key) ?? null; },
    setItem(key, value) { if (blockedStorage) throw new Error('blocked'); storage.set(key, value); },
  } };
  class HTMLElement { getClientRects() { return [1]; } }
  const document = { querySelector: () => targets ? new HTMLElement() : null, createElement() { return { addEventListener(_event, fn) { this.click = fn; } }; } };
  const globals = { window, document, HTMLElement, requestAnimationFrame: fn => { frames.set(++nextFrame, fn); return nextFrame; }, cancelAnimationFrame: id => frames.delete(id) };
  const history = load('storage.ts', {}, { window });
  const steps = load('steps.ts');
  const { AdminGuide } = load('admin-guide.tsx', {
    react: { useEffect: fn => { effect = fn; }, useRef: value => ({ current: value }) },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    './storage': history, './steps': steps,
    'driver.js': { driver(config) {
      const tour = { config, active: false, drive() { this.active = true; runs.push(this); }, destroy() { if (!this.active) return; this.active = false; config.onDestroyed(null, null, { reason: 'api' }); }, finish(reason) { this.active = false; config.onDestroyed(null, null, { reason }); } };
      return tour;
    } },
  }, globals);
  const flush = () => { for (const [id, fn] of frames) { frames.delete(id); fn(); } };
  return { runs, storage, history,
    mount(props = {}) { const button = AdminGuide({ guide: 'course-basic', admin: true, ...props }); cleanup = effect(); flush(); return button; },
    unmount() { cleanup?.(); },
    resize(matches) { media.matches = matches; for (const fn of mediaListeners) fn(); flush(); },
    skip() { let button; const tour = runs.at(-1); tour.config.onPopoverRender({ footerButtons: { prepend(value) { button = value; } } }, { driver: tour }); assert.equal(button.type, 'button'); assert.equal(button.textContent, '건너뛰기'); button.click(); },
  };
}

test('verified admin starts once, skip persists, and replay does not require another API', () => {
  const storage = new Map(), first = runtime({ storage });
  const button = first.mount();
  assert.equal(first.runs.length, 1);
  assert.equal(first.runs[0].config.steps.length, 11);
  assert.equal(first.runs[0].config.disableActiveInteraction, true);
  first.skip();
  assert.equal(first.runs[0].active, false);
  button.props.onClick();
  assert.equal(first.runs.length, 2);
  first.unmount();
  const revisit = runtime({ storage });
  revisit.mount();
  assert.equal(revisit.runs.length, 0);
  revisit.unmount();
});

test('completion and explicit dismissals suppress automatic repeat', () => {
  for (const reason of ['done', 'close', 'escape', 'overlay']) {
    const ui = runtime(); ui.mount(); ui.runs[0].finish(reason);
    assert.equal(ui.history.hasViewedGuide('course-basic'), true);
    assert.equal(ui.history.hasViewedGuide('course-curriculum'), false);
    ui.unmount();
  }
});

test('stored flags cannot enable tours for non-admins or mobile', () => {
  const storage = new Map([['admin', 'true']]);
  const guest = runtime({ storage }); assert.equal(guest.mount({ admin: false }), null); assert.equal(guest.runs.length, 0); guest.unmount();
  const mobile = runtime({ desktop: false }); mobile.mount(); assert.equal(mobile.runs.length, 0);
  mobile.resize(true); assert.equal(mobile.runs.length, 1);
  mobile.resize(false); assert.equal(mobile.runs[0].active, false);
  assert.equal(mobile.history.hasViewedGuide('course-basic'), false);
  mobile.unmount();
});

test('leaving, paused screens and missing targets do not consume the first visit', () => {
  const ui = runtime(); ui.mount(); ui.unmount(); assert.equal(ui.runs[0].active, false); assert.equal(ui.storage.size, 0);
  const paused = runtime(); assert.equal(paused.mount({ paused: true }), null); assert.equal(paused.runs.length, 0);
  const missing = runtime({ targets: false }); missing.mount(); assert.equal(missing.runs.length, 0); assert.equal(missing.storage.size, 0); missing.unmount();
});

test('blocked browser storage still allows dismissal and manual replay', () => {
  const ui = runtime({ blockedStorage: true }); const button = ui.mount(); ui.skip();
  assert.equal(ui.history.hasViewedGuide('course-basic'), true);
  button.props.onClick(); assert.equal(ui.runs.length, 2); ui.unmount();
});
