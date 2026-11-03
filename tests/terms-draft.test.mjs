import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync('src/components/site/use-terms-draft.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function mount(initial, historyState) {
  const exports = {};
  runInNewContext(source, {
    exports,
    window: { history: { state: historyState } },
    require(name) {
      assert.equal(name, 'react');
      return { useState(value) { return [typeof value === 'function' ? value() : value, () => {}]; } };
    },
  });
  return exports;
}

test('a new visit uses initial values even when history contains an old draft', () => {
  const initial = { values: { email: '', password: '' }, agreements: [false] };
  const history = { __quickMathTermsDraft: { key: 'auth:signup', path: '/signup', draft: { values: { email: 'old@example.com' } } } };
  const { useTermsDraft } = mount(initial, history);
  assert.deepEqual(useTermsDraft('auth:signup', initial)[0], initial);
});

test('profile form starts from its saved values rather than an old unsaved draft', () => {
  const initial = { values: { name: '저장된 이름' }, marketing: true };
  const history = { __quickMathTermsDraft: { key: 'profile:user', path: '/profile', draft: { values: { name: '수정 중인 이름' } } } };
  const { useTermsDraft } = mount(initial, history);
  assert.deepEqual(useTermsDraft('profile:user', initial)[0], initial);
});

test('terms paths remain identifiable for existing navigation guards', () => {
  const { isTermsPath } = mount({}, {});
  for (const path of ['/term', '/privacy/collection', '/privacy', '/term/marketing']) assert.equal(isTermsPath(path), true);
  assert.equal(isTermsPath('/signup'), false);
});
