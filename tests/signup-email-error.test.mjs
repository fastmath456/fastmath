import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function load(path, modules) {
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  runInNewContext(source, { exports, require(name) { if (!(name in modules)) throw new Error(`Unexpected import: ${name}`); return modules[name]; } });
  return exports;
}
function find(node, predicate) {
  if (Array.isArray(node)) return node.map(item => find(item, predicate)).find(Boolean);
  if (!node || typeof node !== 'object') return;
  return predicate(node) ? node : find(node.props?.children, predicate);
}

test('signup distinguishes duplicate identities and error codes from other failures', async () => {
  class ApiError extends Error { constructor(status, code, field) { super(code); Object.assign(this, { status, code, field }); } }
  let response;
  const { authenticate } = load('src/server/auth.ts', {
    'next/server': { NextResponse: {} }, '../features/auth': { validateField: () => '' },
    './http': { ApiError, body: async () => ({ email: 'test@example.com', password: 'password123', confirmation: 'password123', name: '학생', birthday: '20080101', phone: '01012345678', agreements: [true, true, true, true, false] }), string: value => value, limit: async () => {}, setting: () => 'https://example.com' },
  });
  const ctx = { params: { action: 'signup' }, request: {}, db: { auth: { signUp: async () => response } } };
  for (const code of ['user_already_exists', 'email_exists']) {
    response = { data: { user: null }, error: { code } };
    await assert.rejects(authenticate(ctx), error => error.code === 'email_already_registered' && error.field === 'email');
  }
  response = { data: { user: { identities: [] } }, error: null };
  await assert.rejects(authenticate(ctx), error => error.code === 'email_already_registered' && error.field === 'email');
  response = { data: { user: null }, error: { code: 'smtp_error' } };
  await assert.rejects(authenticate(ctx), error => error.code === 'signup_failed');
});

function formRuntime() {
  const hooks = []; let index = 0, resolve, reject;
  const request = new Promise((yes, no) => { resolve = yes; reject = no; });
  class RequestError extends Error { constructor(code) { super(code); this.code = code; } }
  const react = {
    useState(initial) { const i = index++; if (!(i in hooks)) hooks[i] = initial; return [hooks[i], value => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value; }]; },
    useRef(initial) { const i = index++; return hooks[i] ??= { current: initial }; },
  };
  const { AuthForm } = load('src/features/auth/auth-form.tsx', {
    react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'next/link': { default: 'link' }, 'next/navigation': { useRouter: () => ({ push() {}, refresh() {}, back() {} }) },
    '@tanstack/react-query': { useQueryClient: () => ({ clear() {} }) },
    '@/lib/http': { mutate: () => request, RequestError, requestFailure: '요청 실패' },
    '@/components/site': { Checkbox: 'checkbox', FormField: 'field', ConfirmationDialog: 'dialog', Logo: 'logo', SiteFooter: 'footer', SiteHeader: 'header', useTermsDraft: () => react.useState({ values: { email: 'test@example.com', name: '학생', birthday: '20080101', phone: '01012345678', password: 'password123', confirmation: 'password123' }, agreements: [true, true, true, true, false] }) },
    './validation': { fieldsByKind: { signup: ['email'] }, fieldLabels: { email: '이메일' }, placeholders: {}, validateField: () => '' },
    './phone': { editPhone() {}, formatPhone: value => value }, './use-login-redirect': { useLoginRedirect: () => ({ redirectIfUnauthorized: () => false }) }, './auth.module.css': { default: {} },
  });
  return { render: () => { index = 0; return AuthForm({ kind: 'signup' }); }, resolve, reject, RequestError };
}

test('duplicate message persists on blur and clears when the email is edited', async () => {
  const app = formRuntime(); let tree = app.render();
  const pending = find(tree, n => n.type === 'form').props.onSubmit({ preventDefault() {}, currentTarget: { querySelector() {} } });
  app.reject(new app.RequestError('email_already_registered')); await pending;
  tree = app.render(); let field = find(tree, n => n.type === 'field' && n.props.name === 'email');
  assert.equal(field.props.value, 'test@example.com');
  assert.equal(field.props.error, '이미 가입한 이메일입니다.');
  field.props.onBlur(); tree = app.render(); field = find(tree, n => n.type === 'field' && n.props.name === 'email');
  assert.equal(field.props.error, '이미 가입한 이메일입니다.');
  field.props.onChange({ currentTarget: { value: 'new@example.com' } }); tree = app.render(); field = find(tree, n => n.type === 'field' && n.props.name === 'email');
  assert.equal(field.props.value, 'new@example.com');
  assert.equal(field.props.error, undefined);
});

test('a late duplicate response does not mark a newly edited email as duplicate', async () => {
  const app = formRuntime(); let tree = app.render();
  const pending = find(tree, n => n.type === 'form').props.onSubmit({ preventDefault() {}, currentTarget: { querySelector() {} } });
  find(tree, n => n.type === 'field' && n.props.name === 'email').props.onChange({ currentTarget: { value: 'new@example.com' } });
  app.reject(new app.RequestError('email_already_registered')); await pending;
  tree = app.render(); const field = find(tree, n => n.type === 'field' && n.props.name === 'email');
  assert.equal(field.props.value, 'new@example.com');
  assert.equal(field.props.error, undefined);
});
