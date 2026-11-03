import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(path, modules) {
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  runInNewContext(source, { exports, require(name) { if (!(name in modules)) throw new Error(`Unexpected import: ${name}`); return modules[name]; } });
  return exports;
}
function findAll(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => findAll(child, predicate));
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...findAll(node.props?.children, predicate)];
}
function field(label, id) {
  let visible = false;
  const { PasswordInput } = load('src/components/site/password-input.tsx', { react: { useState: () => [visible, change => { visible = change(visible); }] }, 'react/jsx-runtime': jsx, './site.module.css': { default: {} } });
  return () => PasswordInput({ label, id, value: '비밀번호123', autoComplete: 'new-password' });
}

test('password visibility toggles without changing value or another field', () => {
  const password = field('비밀번호', 'password'), confirmation = field('비밀번호 확인', 'confirmation');
  let tree = password(), input = findAll(tree, n => n.type === 'input')[0], button = findAll(tree, n => n.type === 'button')[0];
  assert.equal(input.props.type, 'password');
  assert.equal(button.props.type, 'button');
  assert.equal(button.props['aria-label'], '비밀번호 보기');
  assert.equal(button.props['aria-pressed'], false);
  assert.equal(findAll(tree, n => n.type === 'path').length, 2);
  button.props.onClick(); tree = password(); input = findAll(tree, n => n.type === 'input')[0]; button = findAll(tree, n => n.type === 'button')[0];
  assert.equal(input.props.type, 'text');
  assert.equal(input.props.value, '비밀번호123');
  assert.equal(input.props.autoComplete, 'new-password');
  assert.equal(button.props['aria-label'], '비밀번호 숨기기');
  assert.equal(button.props['aria-pressed'], true);
  assert.equal(findAll(tree, n => n.type === 'path').length, 1);
  assert.equal(findAll(confirmation(), n => n.type === 'input')[0].props.type, 'password');
  assert.equal(findAll(confirmation(), n => n.type === 'button')[0].props['aria-label'], '비밀번호 확인 보기');
  button.props.onClick(); assert.equal(findAll(password(), n => n.type === 'input')[0].props.type, 'password');
});

test('FormField uses the visibility control for passwords and preserves errors', () => {
  const { FormField } = load('src/components/site/site.tsx', {
    'next/image': 'image', 'next/link': 'link', 'react/jsx-runtime': jsx,
    './mobile-menu': { MobileMenu: 'menu' }, './password-input': { PasswordInput: 'password-input' }, './skeleton': { Skeleton: 'skeleton' }, './site.module.css': { default: {} },
  });
  const password = FormField({ id: 'password', label: '비밀번호', type: 'password', description: '안내', error: '오류' });
  const control = findAll(password, n => n.type === 'password-input')[0];
  assert.equal(control.props.label, '비밀번호');
  assert.equal(control.props['aria-invalid'], true);
  assert.equal(control.props['aria-describedby'], 'password-description password-error');
  const email = FormField({ id: 'email', label: '이메일', type: 'email' });
  assert.equal(findAll(email, n => n.type === 'password-input').length, 0);
  assert.equal(findAll(email, n => n.type === 'input')[0].props.type, 'email');
});
