import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync('src/features/classroom/viewer-screen.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const find = (node, predicate) => {
  if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean);
  if (!node || typeof node !== 'object') return undefined;
  return predicate(node) ? node : find(node.props?.children, predicate);
};

function viewer({ reducedMotion = false, preview = false } = {}) {
  const slots = [], effects = [], timers = new Map(), listeners = new Set(), routes = [];
  let cursor = 0, nextTimer = 0, restored = 0;
  const trigger = new (class Element { focus() { restored++; } })();
  const dialog = { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
  const desktop = { matches: false, addEventListener: (_name, fn) => listeners.add(fn), removeEventListener: (_name, fn) => listeners.delete(fn) };
  const useSlot = initial => { const index = cursor++; if (!(index in slots)) slots[index] = initial; return index; };
  const react = {
    useId: () => 'curriculum-test',
    useRef(initial) { const index = useSlot({ current: initial }); return slots[index]; },
    useState(initial) { const index = useSlot(initial); return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useEffect(effect, deps) {
      const index = useSlot(null), previous = slots[index];
      if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
        effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: effect() }; });
      }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const course = { title: '수학1 개념 완성', recentLessonId: 'first', chapters: [
    { id: 'chapter', title: '01. 지수와 로그', lessons: [{ id: 'first', title: '첫 강의', preview: true }, { id: 'second', title: '다음 강의', preview: false }] },
  ] };
  const modules = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'next/image': 'image', 'next/link': 'link', 'next/navigation': { useRouter: () => ({ push: path => routes.push(path), back() {} }) },
    '@tanstack/react-query': { useQuery: () => ({ isPending: false, data: course }) },
    '@/lib/http': { isUnauthorized: () => false },
    '@/features/account': { useProfile: () => ({}) }, '@/features/catalog': {},
    '@/features/auth': { useLoginRedirect: () => ({ requiresLogin: false }) },
    '@/components/site': { SiteHeader: 'header', SiteFooter: 'footer', ConfirmationDialog: 'payment-dialog' },
    './video-player': { VideoPlayer: 'video' }, './api': {}, './classroom-skeletons': {},
  };
  const exports = {};
  runInNewContext(source, {
    exports, HTMLElement: trigger.constructor, document: { activeElement: trigger },
    window: {
      matchMedia: query => query.includes('reduced-motion') ? { matches: reducedMotion } : desktop,
      setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
      clearTimeout: id => timers.delete(id),
    },
    require(name) { if (name.endsWith('.module.css')) return {}; if (name in modules) return modules[name]; throw new Error(name); },
  });
  function render() {
    cursor = 0;
    const tree = exports.ViewerScreen({ courseId: 'course', preview });
    const modal = find(tree, node => node.type === 'dialog');
    if (modal) modal.props.ref.current = dialog;
    for (const effect of effects.splice(0)) effect();
    return tree;
  }
  const menuButton = tree => find(tree, node => node.type === 'header').props.mobile.menu;
  function open() { menuButton(render()).props.onClick(); return render(); }
  return { render, open, menuButton, timers, routes, dialog, desktop, listeners, restored: () => restored };
}

test('viewer uses its curriculum control and keeps the modal mounted through the 200ms fade-out', () => {
  const ui = viewer();
  assert.equal(find(ui.render(), node => node.type === 'dialog'), undefined);
  const menu = find(ui.open(), node => node.type === 'dialog');
  assert.equal(ui.dialog.open, true);
  assert.equal(menu.props['aria-labelledby'], 'curriculum-test-title');
  const header = find(menu, node => node.type === 'header');
  assert.equal(header.props.mobile.backIcon, '/assets/viewer-menu-back.svg');
  header.props.mobile.menu.props.onClick();
  assert.equal(find(ui.render(), node => node.type === 'dialog').props['data-closing'], true);
  const timer = [...ui.timers.values()][0];
  assert.equal(timer.delay, 200);
  assert.equal(ui.dialog.open, true);
  timer.callback();
  assert.equal(find(ui.render(), node => node.type === 'dialog'), undefined);
  assert.equal(ui.dialog.open, false);
  assert.equal(ui.restored(), 1);
  assert.equal(ui.listeners.size, 0);
});

test('Escape cancels through fade-out, reduced motion skips the delay, and reopening clears stale closure', () => {
  for (const reducedMotion of [false, true]) {
    const ui = viewer({ reducedMotion });
    let prevented = false;
    find(ui.open(), node => node.type === 'dialog').props.onCancel({ preventDefault() { prevented = true; } });
    ui.render();
    assert.equal(prevented, true);
    assert.equal([...ui.timers.values()][0].delay, reducedMotion ? 0 : 200);
    ui.menuButton(ui.render()).props.onClick();
    assert.equal(find(ui.render(), node => node.type === 'dialog').props['data-closing'], false);
    assert.equal(ui.timers.size, 0);
  }
});

test('curriculum selection keeps routing and preview access checks, while desktop and modal IDs stay distinct', () => {
  for (const preview of [false, true]) {
    const ui = viewer({ preview }), tree = ui.open(), menu = find(tree, node => node.type === 'dialog');
    const chapter = find(menu, node => node.type === 'button' && node.props['aria-controls']);
    assert.equal(chapter.props['aria-controls'], 'curriculum-test-unit-chapter');
    const desktop = find(tree, node => node.type === 'main');
    assert.equal(find(desktop, node => node.type === 'button' && node.props['aria-controls']).props['aria-controls'], 'curriculum-test-desktop-unit-chapter');
    find(menu, node => node.type === 'button' && node.props.children === '다음 강의').props.onClick();
    assert.deepEqual(ui.routes, preview ? [] : ['/classroom/courses/course?lesson=second']);
    assert.equal(Boolean(find(ui.render(), node => node.type === 'payment-dialog')), preview);
  }
});
