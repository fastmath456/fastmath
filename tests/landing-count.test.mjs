import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync('src/features/landing/use-statistics-count.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function mount() {
  const section = {};
  const frames = new Map();
  let effect, notify, progress, observing = false, frameId = 0;
  const exports = {};
  runInNewContext(source, {
    exports,
    require(name) {
      assert.equal(name, 'react');
      return {
        useRef: () => ({ current: section }),
        useState(initial) {
          progress = initial;
          return [progress, value => { progress = value; }];
        },
        useEffect(callback) { effect = callback; },
      };
    },
    IntersectionObserver: class {
      constructor(callback) { notify = callback; }
      observe(target) { assert.equal(target, section); observing = true; }
      disconnect() { observing = false; }
    },
    performance: { now: () => 500 },
    requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
  });
  exports.useStatisticsCount();
  const unmount = effect();
  return {
    get progress() { return progress; },
    get pendingFrames() { return frames.size; },
    get observing() { return observing; },
    visibility(isIntersecting) { notify([{ isIntersecting }]); },
    frame(elapsed) {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach(callback => callback(500 + elapsed));
    },
    unmount,
  };
}

test('statistics stay at zero until the section first enters the viewport', () => {
  const count = mount();
  count.visibility(false);
  count.frame(3000);
  assert.equal(count.progress, 0);
  assert.equal(count.pendingFrames, 0);
  assert.equal(count.observing, true);
  count.unmount();
  count.visibility(true);
  assert.equal(count.observing, false);
  assert.equal(count.pendingFrames, 0);
});

test('the first appearance counts from zero to the target over exactly two seconds', () => {
  const count = mount();
  count.visibility(true);
  for (const elapsed of [0, 500, 1000, 1999, 2000]) {
    count.frame(elapsed);
    assert.equal(count.progress, elapsed / 2000);
  }
  assert.equal(count.pendingFrames, 0);
  assert.equal(count.observing, false);
  count.unmount();
});

test('re-entering the viewport and queued notifications never restart the count', () => {
  const count = mount();
  count.visibility(true);
  count.frame(1000);
  count.visibility(false);
  count.visibility(true);
  assert.equal(count.pendingFrames, 1);
  assert.equal(count.progress, 0.5);
  count.frame(2500);
  count.visibility(true);
  assert.equal(count.progress, 1);
  assert.equal(count.pendingFrames, 0);
  count.unmount();
});

test('unmount cancels the unfinished animation and disconnects the observer', () => {
  const count = mount();
  count.visibility(true);
  count.frame(500);
  count.unmount();
  count.frame(2000);
  assert.equal(count.progress, 0.25);
  assert.equal(count.pendingFrames, 0);
  assert.equal(count.observing, false);
});
