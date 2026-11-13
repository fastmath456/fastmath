import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync('src/features/manage/touch-order.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function setup() {
  const listeners = new Map(), timers = new Map(), moves = [], exports = {};
  let timerId = 0;
  class Card {
    constructor(index) { this.dataset = { orderIndex: String(index) }; }
    closest() { return this; }
  }
  const cards = [new Card(0), new Card(1), new Card(2)];
  let target = cards[2];
  const grid = {
    contains: card => cards.includes(card),
    ownerDocument: { elementFromPoint: () => target },
    addEventListener: (type, handler, options) => listeners.set(type, { handler, options }),
    removeEventListener: type => listeners.delete(type),
  };
  runInNewContext(source, { exports, Element: Card,
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id),
  });
  const cleanup = exports.bindTouchOrder(grid, (from, to) => moves.push([from, to]));
  const touch = (x = 0, y = 0, identifier = 1) => ({ identifier, clientX: x, clientY: y });
  const emit = (type, values = {}) => {
    const event = { target: cards[0], touches: [touch()], changedTouches: [touch()], cancelable: true, prevented: false,
      preventDefault() { this.prevented = true; }, ...values };
    listeners.get(type)?.handler(event);
    return event;
  };
  const hold = () => { for (const callback of timers.values()) callback(); timers.clear(); };
  return { emit, hold, touch, moves, cleanup, timers, listeners, outside: () => { target = new Card(9); } };
}

test('holding and dropping on another card reorders once and blocks native scrolling only during drag', () => {
  const r = setup();
  assert.equal(r.listeners.get('touchmove').options.passive, false);
  r.emit('touchstart'); r.hold();
  assert.equal(r.emit('touchmove', { touches: [r.touch(40, 70)] }).prevented, true);
  assert.equal(r.emit('touchend', { touches: [], changedTouches: [r.touch(40, 70)] }).prevented, true);
  r.emit('touchend', { touches: [] });
  assert.deepEqual(r.moves, [[0, 2]]);
});

test('ordinary swipes and quick taps retain native scrolling without changing the order', () => {
  for (const swipe of [false, true]) {
    const r = setup(); r.emit('touchstart');
    if (swipe) {
      assert.equal(r.emit('touchmove', { touches: [r.touch(0, 30)] }).prevented, false);
      r.hold();
    }
    r.emit('touchend', { touches: [] });
    assert.deepEqual(r.moves, []);
    assert.equal(r.timers.size, 0);
  }
});

test('cancellation, multitouch, noncancelable scrolling and outside drops cannot move cards', () => {
  for (const cancel of ['touchcancel', 'multitouch', 'scroll', 'outside']) {
    const r = setup(); r.emit('touchstart'); r.hold();
    if (cancel === 'touchcancel') r.emit('touchcancel');
    if (cancel === 'multitouch') r.emit('touchstart', { touches: [r.touch(), r.touch(1, 1, 2)] });
    if (cancel === 'scroll') r.emit('touchmove', { cancelable: false });
    if (cancel === 'outside') r.outside();
    r.emit('touchend', { touches: [] });
    assert.deepEqual(r.moves, []);
  }
});

test('unmount clears pending holds and removes every listener', () => {
  const r = setup(); r.emit('touchstart'); r.cleanup(); r.hold();
  assert.equal(r.timers.size, 0);
  assert.equal(r.listeners.size, 0);
  assert.deepEqual(r.moves, []);
});
