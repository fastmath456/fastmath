import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync('src/features/catalog/product-detail.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
function find(node, predicate) {
  if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean);
  if (!node || typeof node !== 'object') return undefined;
  return predicate(node) ? node : find(node.props?.children, predicate);
}

function detail(kind, { reducedMotion = false, scrollHeight = 3200, title = '수학1' } = {}) {
  const slots = [], effects = [], listeners = new Map(), moves = [], historyEntries = [];
  let cursor = 0;
  const product = { id: 'product', title, price: 1000, tags: [], chapters: [], selling: true,
    reviews: [{ author: '학생', rating: 5, body: '후기', date: '2026.10.20' }] };
  const location = { hash: '' };
  const window = {
    scrollY: 1410, innerHeight: 720,
    matchMedia: () => ({ matches: reducedMotion }),
    addEventListener(name, callback) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
    removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
  };
  const positions = { info: 578, reviews: 1514, refund: 1686 };
  const sections = Object.fromEntries(Object.entries(positions).map(([id, top]) => [id, {
    getBoundingClientRect: () => ({ top: top - window.scrollY }),
    scrollIntoView(options) {
      moves.push({ id, ...options });
      if (options?.behavior !== 'smooth') window.scrollY = Math.max(0, Math.min(top - 104, scrollHeight - window.innerHeight));
    },
  }]));
  const useSlot = initial => { const index = cursor++; if (!(index in slots)) slots[index] = initial; return index; };
  const react = {
    useCallback: callback => callback,
    useRef(initial) { return slots[useSlot({ current: initial })]; },
    useState(initial) { const index = useSlot(initial); return [slots[index], value => { slots[index] = value; }]; },
    useEffect(effect, deps) {
      const index = useSlot(null), previous = slots[index];
      if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
        effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: effect() }; });
      }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const modules = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'next/image': 'image', 'next/link': 'link', 'next/navigation': { useRouter: () => ({}) },
    '@tanstack/react-query': { useQuery: () => ({ data: product }) },
    '@/components/site': { SiteHeader: 'header', SiteFooter: 'footer' }, '@/features/manage': {},
    '@/features/auth': { useLoginRedirect: () => ({}) }, './api': {}, './checkout': {},
    './refund-copy': { refundIntro: '', refundSections: [], refundEmphasis: 'test' }, './product-skeletons': {},
  };
  const exports = {};
  runInNewContext(source, {
    exports, window, location,
    history: { pushState(_state, _title, hash) { location.hash = hash; historyEntries.push(hash); } },
    document: { getElementById: id => sections[id], documentElement: { scrollHeight } },
    getComputedStyle: () => ({ scrollMarginTop: '104px' }),
    require(name) { if (name.endsWith('.module.css')) return { reviewMeta: 'reviewMeta' }; if (name in modules) return modules[name]; throw new Error(name); },
  });
  function render() {
    cursor = 0;
    const tree = exports.ProductDetailScreen({ slug: 'product', kind });
    for (const effect of effects.splice(0)) effect();
    return tree;
  }
  const tabs = () => find(render(), node => node.type === 'nav' && node.props['aria-label'] === '상품 상세 섹션');
  const active = () => find(tabs(), node => node.props?.['aria-current'] === 'location').props.href;
  const click = (id, extra = {}) => {
    let prevented = false;
    find(tabs(), node => node.props?.href === '#' + id).props.onClick({ button: 0, preventDefault() { prevented = true; }, ...extra });
    return prevented;
  };
  const dispatch = (name, event = {}) => { for (const callback of listeners.get(name) ?? []) callback(event); };
  const scroll = y => { window.scrollY = y; dispatch('scroll'); };
  render();
  return { render, active, click, scroll, dispatch, moves, historyEntries, listeners,
    unmount() { for (const slot of slots) slot?.cleanup?.(); } };
}

for (const kind of ['vod', 'pdf']) {
  test(`${kind}: a short review cannot override the clicked tab during smooth scrolling or restart the same move`, () => {
    const ui = detail(kind);
    ui.click('refund');
    assert.equal(ui.active(), '#refund');
    ui.scroll(1430);
    assert.equal(ui.active(), '#refund');
    ui.click('refund');
    assert.equal(ui.moves.length, 1);
    assert.deepEqual(ui.historyEntries, ['#refund']);
    ui.scroll(1582);
    ui.scroll(1410);
    assert.equal(ui.active(), '#reviews', 'position tracking resumes after arrival');
  });

  test(`${kind}: the latest different click wins over an earlier scroll destination`, () => {
    const ui = detail(kind);
    ui.click('refund'); ui.scroll(1460); ui.click('info');
    ui.scroll(1582);
    assert.equal(ui.active(), '#info');
    ui.click('info');
    assert.equal(ui.moves.length, 2);
    ui.scroll(474); ui.scroll(1410);
    assert.equal(ui.active(), '#reviews');
  });

  test(`${kind}: wheel, touch scrolling, and scroll keys restore position tracking`, () => {
    for (const [event, payload] of [['wheel', {}], ['touchmove', {}], ['keydown', { key: 'ArrowUp' }], ['keydown', { key: ' ' }]]) {
      const ui = detail(kind);
      ui.click('refund'); ui.scroll(1460); ui.dispatch(event, payload); ui.scroll(1200);
      assert.equal(ui.active(), '#info', event);
    }
    const ui = detail(kind);
    ui.click('refund'); ui.dispatch('keydown', { key: 'Tab' }); ui.scroll(1460);
    assert.equal(ui.active(), '#refund', 'focus navigation does not interrupt the move');
    ui.dispatch('scrollend');
    assert.equal(ui.active(), '#reviews', 'an interrupted move releases the lock when scrolling stops');
  });

  test(`${kind}: reduced motion and an already aligned target do not leave a stale selection lock`, () => {
    const instant = detail(kind, { reducedMotion: true });
    instant.click('refund');
    assert.equal(instant.moves[0].behavior, 'instant');
    instant.scroll(1410);
    assert.equal(instant.active(), '#reviews');
    const aligned = detail(kind);
    aligned.click('reviews'); aligned.scroll(1200);
    assert.equal(aligned.active(), '#info');
    const bottom = detail(kind, { scrollHeight: 2200 });
    bottom.click('refund'); bottom.scroll(1480);
    assert.equal(bottom.active(), '#refund');
    bottom.scroll(1410);
    assert.equal(bottom.active(), '#reviews', 'a destination clamped to the page end releases the lock');
  });

  test(`${kind}: modified links retain native behavior and unmount removes all listeners`, () => {
    const ui = detail(kind);
    for (const extra of [{ button: 1 }, { metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }]) {
      assert.equal(ui.click('refund', extra), false);
    }
    assert.equal(ui.moves.length, 0);
    ui.unmount();
    assert.ok([...ui.listeners.values()].every(callbacks => callbacks.size === 0));
  });
}

for (const kind of ['vod', 'pdf']) {
  test(`${kind}: review titles include spaces in the ten-character limit without changing the purchase title`, () => {
    for (const [title, expected] of [
      ['수학1 개념', '수학1 개념'],
      ['12345 7890', '12345 7890'],
      ['12345 78901', '12345 7890...'],
      ['수학1 개념 완성수학1 개념 완성', '수학1 개념 완성수...'],
      ['📚1234567890', '📚123456789...'],
    ]) {
      const tree = detail(kind, { title }).render();
      const meta = find(tree, node => node.props?.className === 'reviewMeta');
      assert.equal(meta.props.children[0].props.children, expected);
      assert.equal(find(tree, node => node.type === 'h1').props.children, title);
      assert.equal(meta.props.children[2].props.children, '학생');
      assert.equal(meta.props.children[4].props.children, '2026.10.20');
    }
  });
}
