import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync('src/components/site/mobile-menu.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function find(node, predicate) {
  if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean);
  if (!node || typeof node !== 'object') return;
  return predicate(node) ? node : find(node.props?.children, predicate);
}
function menu() {
  let cursor = 0, visible = true;
  const slots = [], effects = [], listeners = new Map();
  const root = { style: { overflow: 'auto' } }, body = { style: { overflow: 'scroll' } };
  const trigger = { getClientRects: () => visible ? [{}] : [] };
  const react = {
    useId: () => 'menu',
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(effect, deps) { const index = cursor++; const previous = slots[index]; if (!previous || deps.some((value, i) => value !== previous.deps[i])) effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: effect() }; }); },
  };
  const modules = { react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }, 'next/image': 'image', 'next/link': 'link', 'next/navigation': { usePathname: () => '/' }, './skeleton': { Skeleton: 'skeleton' }, './site.module.css': { default: {} } };
  const exports = {};
  runInNewContext(source, { exports, document: { documentElement: root, body }, window: { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); } }, require: name => modules[name] });
  const render = () => { cursor = 0; const tree = exports.MobileMenu({}); find(tree, node => node.type === 'button').props.ref.current = trigger; for (const effect of effects.splice(0)) effect(); return tree; };
  const toggle = () => { find(render(), node => node.type === 'button').props.onClick(); return render(); };
  return { root, body, listeners, render, toggle, hide: () => { visible = false; }, unmount: () => { for (const slot of slots) slot?.cleanup?.(); } };
}

test('opening locks page scrolling and closing restores the original overflow value', () => {
  const ui = menu();
  assert.equal(ui.root.style.overflow, 'auto');
  assert.equal(ui.body.style.overflow, 'scroll');
  assert.equal(find(ui.toggle(), node => node.type === 'nav').props['aria-label'], '사이트·계정 메뉴');
  assert.equal(ui.root.style.overflow, 'hidden');
  assert.equal(ui.body.style.overflow, 'scroll');
  assert.ok(ui.listeners.has('resize'));
  ui.toggle();
  assert.equal(ui.root.style.overflow, 'auto');
  assert.equal(ui.body.style.overflow, 'scroll');
  assert.equal(ui.listeners.size, 0);
});

test('hiding the mobile header on resize closes the menu and releases the lock', () => {
  const ui = menu();
  ui.toggle(); ui.hide(); ui.listeners.get('resize')();
  assert.equal(find(ui.render(), node => node.type === 'nav'), undefined);
  assert.equal(ui.root.style.overflow, 'auto');
  assert.equal(ui.body.style.overflow, 'scroll');
  assert.equal(ui.listeners.size, 0);
});

test('unmounting an open menu restores scrolling', () => {
  const ui = menu(); ui.toggle(); ui.unmount();
  assert.equal(ui.root.style.overflow, 'auto');
  assert.equal(ui.body.style.overflow, 'scroll');
  assert.equal(ui.listeners.size, 0);
});
