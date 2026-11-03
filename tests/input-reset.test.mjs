import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync('src/components/site/reset-on-leave.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function mount() {
  let version = 0, hide, show;
  const exports = {};
  runInNewContext(source, {
    exports,
    window: {
      addEventListener(type, handler) { assert.equal(type, 'pageshow'); show = handler; },
      removeEventListener() {},
    },
    require(name) {
      if (name === 'react/jsx-runtime') return { jsx: (_type, _props, key) => ({ key }) };
      assert.equal(name, 'react');
      return {
        Fragment: Symbol('Fragment'),
        useState: () => [version, update => { version = update(version); }],
        useLayoutEffect: setup => { hide = setup(); },
        useEffect: setup => { setup(); },
      };
    },
  });
  const render = () => exports.ResetOnLeave({ children: null }).key;
  render();
  return { render, hide: () => hide(), show: persisted => show({ persisted }) };
}

test('returning after a page is hidden starts a new form state', () => {
  const form = mount();
  const before = form.render();
  form.hide();
  assert.notEqual(form.render(), before);
});

test('restoring a page from the browser cache starts a new form state', () => {
  const form = mount();
  const before = form.render();
  form.show(false);
  assert.equal(form.render(), before);
  form.show(true);
  assert.notEqual(form.render(), before);
});
