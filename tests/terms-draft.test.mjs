import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync('src/components/site/use-terms-draft.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const initial = { values: { email: '', password: '', name: '' }, agreements: [false, false, false, false] };
const filled = { values: { email: 'draft@example.com', password: 'draft-password', name: '테스트' }, agreements: [true, false, true, false] };
const routerState = { __NA: true, tree: ['signup'], other: 'preserve' };

function mount({ state = routerState, pathname = '/signup', key = 'signup', server = false } = {}) {
  const clicks = new Set(), pageShows = new Set();
  let draft, initialized = false, effect, cleanup;
  const history = { state: structuredClone(state), replaceState(value) { this.state = structuredClone(value); } };
  class Element { closest() { return this; } }
  class Anchor extends Element {
    constructor(href, target = '', download = false) { super(); this.href = href; this.target = target; this.download = download; }
    hasAttribute(name) { return name === 'download' && this.download; }
  }
  const exports = {};
  runInNewContext(source, {
    exports, Element, HTMLAnchorElement: Anchor, URL,
    window: server ? undefined : {
      history, location: { origin: 'http://localhost:3000', pathname, search: '' },
      addEventListener(type, callback) { assert.equal(type, 'pageshow'); pageShows.add(callback); },
      removeEventListener(type, callback) { assert.equal(type, 'pageshow'); pageShows.delete(callback); },
    },
    document: {
      addEventListener(type, callback) { assert.equal(type, 'click'); clicks.add(callback); },
      removeEventListener(type, callback) { assert.equal(type, 'click'); clicks.delete(callback); },
    },
    require(name) {
      assert.equal(name, 'react');
      return {
        useState(initialize) {
          if (!initialized) { draft = initialize(); initialized = true; }
          return [draft, value => { draft = typeof value === 'function' ? value(draft) : value; }];
        },
        useEffect(callback) { effect = callback; },
      };
    },
  });
  function render() { cleanup?.(); const result = exports.useTermsDraft(key, initial); if (!server) cleanup = effect(); return result; }
  render();
  return {
    history,
    get draft() { return structuredClone(draft); },
    change(value) { const [, setDraft] = render(); setDraft(value); render(); },
    click(href, options = {}) {
      const event = { button: 0, target: new Anchor(href, options.target, options.download), ...options };
      for (const listener of clicks) listener(event);
    },
    pageShow() { for (const listener of pageShows) listener(); },
    unmount() { cleanup?.(); },
  };
}

test('full-page terms navigation restores all fields and partial consent, then removes the snapshot', () => {
  const form = mount();
  form.change(filled);
  form.click('http://localhost:3000/term');
  const saved = structuredClone(form.history.state);
  assert.deepEqual(saved.tree, routerState.tree);
  assert.equal(saved.other, routerState.other);
  form.unmount();
  const returned = mount({ state: saved });
  assert.deepEqual(returned.draft, filled);
  assert.deepEqual(returned.history.state, routerState);
  returned.change({ ...filled, agreements: [true, true, true, true] });
  returned.click('http://localhost:3000/privacy/collection?source=signup#details');
  assert.deepEqual(mount({ state: returned.history.state }).draft.agreements, [true, true, true, true]);
});

test('a saved draft cannot cross routes or profile identities', () => {
  const form = mount({ key: 'profile:first@example.com', pathname: '/profile' });
  form.change(filled);
  form.click('http://localhost:3000/term/marketing');
  assert.deepEqual(mount({ state: form.history.state, pathname: '/login', key: 'profile:first@example.com' }).draft, initial);
  assert.deepEqual(mount({ state: form.history.state, pathname: '/profile', key: 'profile:second@example.com' }).draft, initial);
});

test('profile drafts retain the selected image, removal state, and original save revision', () => {
  const profile = { ...filled, baseline: { revision: 4 }, imageChanged: true, selectedFile: { name: 'profile.png', preview: 'data:image/png;base64,iVBORw0KGgo=' } };
  const form = mount({ pathname: '/profile', key: 'profile:first@example.com' });
  form.change(profile);
  form.click('http://localhost:3000/term/marketing');
  const returned = mount({ state: form.history.state, pathname: '/profile', key: 'profile:first@example.com' });
  assert.deepEqual(returned.draft, profile);
  returned.change({ ...profile, selectedFile: undefined });
  returned.click('http://localhost:3000/privacy');
  const removed = mount({ state: returned.history.state, pathname: '/profile', key: 'profile:first@example.com' });
  assert.equal(removed.draft.imageChanged, true);
  assert.equal(removed.draft.selectedFile, undefined);
  assert.equal(removed.draft.baseline.revision, 4);
});

test('unrelated, external, download, modified, and new-tab clicks do not save a draft', () => {
  const form = mount();
  form.change(filled);
  form.click('http://localhost:3000/courses');
  form.click('https://example.com/term');
  form.click('http://localhost:3000/term', { target: '_blank' });
  form.click('http://localhost:3000/term', { download: true });
  for (const key of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey', 'defaultPrevented']) form.click('http://localhost:3000/term', { [key]: true });
  form.click('http://localhost:3000/term', { button: 1 });
  assert.deepEqual(form.history.state, routerState);
});

test('browser-cache restoration clears the snapshot, and hidden forms stop listening', () => {
  const form = mount();
  form.change(filled);
  form.click('http://localhost:3000/privacy');
  assert.notDeepEqual(form.history.state, routerState);
  form.pageShow();
  assert.deepEqual(form.history.state, routerState);
  assert.deepEqual(form.draft, filled);
  form.unmount();
  form.click('http://localhost:3000/term');
  assert.deepEqual(form.history.state, routerState);
});

test('server rendering uses the empty initial form without browser APIs', () => {
  assert.deepEqual(mount({ server: true }).draft, initial);
});
