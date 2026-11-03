import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function load(path, modules) {
  const source = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  runInNewContext(source, { exports, window: { matchMedia: () => ({ matches: false }) }, require(name) { if (!(name in modules)) throw new Error(`Unexpected import: ${name}`); return modules[name]; } });
  return exports;
}

function findAll(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => findAll(child, predicate));
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...findAll(node.props?.children, predicate)];
}

test('age checkbox is required, has no link, and participates in select all', async () => {
  const hooks = []; let index = 0, requests = 0;
  const react = { useState(initial) { const i = index++; if (!(i in hooks)) hooks[i] = initial; return [hooks[i], value => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value; }]; }, useRef(initial) { const i = index++; return hooks[i] ??= { current: initial }; } };
  const { AuthForm } = load('src/features/auth/auth-form.tsx', {
    react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'next/link': { default: 'link' }, 'next/navigation': { useRouter: () => ({ push() {}, refresh() {}, back() {} }) },
    '@tanstack/react-query': { useQueryClient: () => ({ clear() {} }) },
    '@/lib/http': { mutate: async () => { requests++; }, RequestError: class extends Error {}, requestFailure: 'error' },
    '@/components/site': { Checkbox: 'checkbox', FormField: 'field', ConfirmationDialog: 'dialog', Logo: 'logo', SiteFooter: 'footer', SiteHeader: 'header', useTermsDraft: (_key, draft) => react.useState(draft) },
    './validation': { fieldsByKind: { signup: [] }, fieldLabels: {}, placeholders: {}, validateField: () => '' },
    './phone': { editPhone() {}, formatPhone: value => value }, './use-login-redirect': { useLoginRedirect: () => ({ redirectIfUnauthorized: () => false }) }, './auth.module.css': { default: {} },
  });
  const render = () => { index = 0; return AuthForm({ kind: 'signup' }); };
  let tree = render(), boxes = findAll(tree, n => n.type === 'checkbox');
  assert.equal(boxes.length, 6);
  assert.equal(boxes[4].props.children, '[필수] 만 14세 이상입니다.');
  assert.equal(findAll(tree, n => n.type === 'link' && n.props.children === '보기').length, 4);
  boxes[0].props.onChange(); tree = render(); boxes = findAll(tree, n => n.type === 'checkbox');
  assert.ok(boxes.every(box => box.props.checked));
  boxes[4].props.onChange(); tree = render();
  let focused = '', scroll;
  const submit = findAll(tree, n => n.type === 'form')[0].props.onSubmit;
  await submit({ preventDefault() {}, currentTarget: { querySelector: selector => ({ scrollIntoView(options) { scroll = options; }, focus(options) { focused = selector; assert.equal(options.preventScroll, true); } }) } });
  assert.equal(requests, 0);
  assert.equal(focused, '#agreement-3');
  assert.equal(scroll.behavior, 'smooth');
  assert.equal(scroll.block, 'center');
  tree = render(); assert.ok(findAll(tree, n => n.type === 'p' && n.props.children === '필수 약관에 동의해주세요.').length);
});

test('signup requires age consent and preserves optional marketing mapping', async () => {
  class ApiError extends Error { constructor(status, code) { super(code); this.status = status; this.code = code; } }
  let payload; let input;
  const { authenticate } = load('src/server/auth.ts', {
    'next/server': { NextResponse: {} }, '../features/auth': { validateField: () => '' },
    './http': { ApiError, body: async () => input, string: value => value, limit: async () => {}, setting: () => 'https://example.com' },
  });
  const ctx = { params: { action: 'signup' }, request: {}, db: { auth: { signUp: async value => { payload = value; return { data: { user: { identities: [{}] }, session: null }, error: null }; } } } };
  const basic = { email: 'test@example.com', password: 'password123', confirmation: 'password123', name: '학생', birthday: '20080101', phone: '01012345678' };
  input = { ...basic, agreements: [true, true, true, false, true] };
  await assert.rejects(authenticate(ctx), error => error.code === 'agreements_required');
  assert.equal(payload, undefined);
  for (const marketing of [false, true]) {
    input = { ...basic, agreements: [true, true, true, true, marketing] };
    assert.equal((await authenticate(ctx)).ok, true);
    assert.deepEqual(Array.from(payload.options.data.agreements), [true, true, true, marketing]);
    assert.equal(payload.options.data.marketing, marketing);
    assert.equal(payload.options.data.age_confirmed, true);
  }
});
