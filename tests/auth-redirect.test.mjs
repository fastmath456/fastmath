import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const compiled = new Map();
function load(file, modules = {}, globals = {}) {
  if (!compiled.has(file)) compiled.set(file, ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText);
  const exports = {};
  runInNewContext(compiled.get(file), {
    exports, process: { env: { NODE_ENV: 'test' } }, FormData, Response, ...globals,
    require(name) {
      if (name in modules) return modules[name];
      if (name.endsWith('.module.css')) return {};
      throw new Error(`Unexpected dependency ${name} in ${file}`);
    },
  });
  return exports;
}
const response = (status, code) => Response.json({ error: { code, field: 'password' } }, { status });
const http = load('src/lib/http.ts');
const unauthorized = () => new http.RequestError('unauthorized', undefined, 401);
const forbidden = () => new http.RequestError('forbidden', undefined, 403);
const serverError = () => new http.RequestError('auth_unavailable', undefined, 503);
const settle = () => new Promise(resolve => setImmediate(resolve));
const validation = load('src/features/auth/validation.ts');

test('HTTP failures retain status, code and field; only a session 401 requires login', async () => {
  assert.deepEqual(await http.readResponse(Response.json({ ok: true })), { ok: true });
  for (const [status, code, expected] of [[401, 'unauthorized', true], [401, 'invalid_credentials', false], [403, 'forbidden', false], [503, 'auth_unavailable', false], [500, 'unauthorized', false]]) {
    await assert.rejects(http.readResponse(response(status, code)), error => {
      assert.equal(error.status, status);
      assert.equal(error.code, code);
      assert.equal(error.field, 'password');
      assert.equal(http.isUnauthorized(error), expected);
      return true;
    });
  }
  assert.equal(http.isUnauthorized(new Error('unauthorized')), false);
  assert.equal(http.isUnauthorized({ code: 'unauthorized', status: 401 }), false);
  assert.equal(http.isUnauthorized(null), false);
});

test('protected reads and the optional profile probe preserve the API error without navigating themselves', async () => {
  const calls = [];
  const globals = { fetch: async path => { calls.push(path); return response(401, 'unauthorized'); } };
  const modules = { '@/lib/http': http };
  const classroom = load('src/features/classroom/api.ts', modules, globals);
  const orders = load('src/features/account/orders-api.ts', modules, globals);
  const profile = load('src/features/account/use-profile.ts', {
    ...modules, '@tanstack/react-query': { useQuery: options => options }, '@/app/providers': { useMockReady: () => true },
  }, globals);
  for (const read of [() => classroom.getClassroom(''), () => classroom.getViewer('course', ''), () => orders.getOrders(''), () => orders.getRefundQuote('order', ''), () => profile.useProfile().queryFn()]) {
    await assert.rejects(read(), http.isUnauthorized);
  }
  assert.deepEqual(calls, ['/api/classroom', '/api/classroom/courses/course', '/api/orders', '/api/orders/order/refund-quote', '/api/profile']);
});

test('mutations preserve the error without retrying or changing the request contract', async () => {
  const calls = [];
  const client = load('src/lib/http.ts', {}, { fetch: async (...args) => { calls.push(args); return response(401, 'unauthorized'); } });
  await assert.rejects(client.mutate('profile', { name: 'changed' }, 'PATCH'), client.isUnauthorized);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], '/api/profile');
  assert.equal(calls[0][1].method, 'PATCH');
  assert.equal(calls[0][1].credentials, 'same-origin');
  assert.equal(calls[0][1].body, JSON.stringify({ name: 'changed' }));
});

// Render component functions with isolated hooks and requests; no browser, payment SDK, or live account is used.
function runtime({ error = null, profileError = null, quoteError = null, data, quote, pathname = '/classroom', mutateError = unauthorized(), draft, state } = {}) {
  const routes = [], effects = [], cleanups = [], writes = [], requests = [], refetches = [], events = {};
  const router = { replace: path => routes.push(['replace', path]), push: path => routes.push(['push', path]), refresh() {} };
  const react = {
    useEffect: effect => effects.push(effect), useCallback: callback => callback, useRef: value => ({ current: value }),
    useState: value => [state ? state(value) : typeof value === 'function' ? value() : value, next => writes.push(next)],
    Fragment: 'fragment',
  };
  const globals = {
    location: { hash: '', replace: path => routes.push(['location', path]) },
    window: { addEventListener() {}, removeEventListener() {}, Vimeo: { Player: class { on(name, callback) { events[name] = callback; } async destroy() {} } } },
    document: { addEventListener() {}, removeEventListener() {}, getElementById: () => null, createElement: () => ({}), head: { append: script => queueMicrotask(() => script.onload()) } },
    performance: { now: () => 6000 }, crypto: { randomUUID: () => 'test-request-key' },
    fetch: async () => new Response('image'),
  };
  const hook = load('src/features/auth/use-login-redirect.ts', { react, 'next/navigation': { useRouter: () => router }, '@/lib/http': http });
  const profile = { error: profileError, data: { name: '테스트', email: 'test@example.com', birthday: '20000101', phone: '01012345678', image: '', avatar: '', marketing: false, revision: 1 } };
  const query = { error, isError: Boolean(error), data, refetch: () => refetches.push('query') };
  const modules = {
    react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'fragment' },
    'next/navigation': { useRouter: () => router, usePathname: () => pathname }, 'next/image': 'image', 'next/link': 'link',
    '@tanstack/react-query': { useQuery: options => options.queryKey[0] === 'refund-quote' ? { error: quoteError, isError: Boolean(quoteError), data: quote, refetch: () => refetches.push('quote') } : query, useQueryClient: () => ({ clear() {}, invalidateQueries: async () => {} }) },
    '@/lib/http': { ...http, mutate: async path => { requests.push(path); if (path === 'playback' && mutateError === 'progress') return { sessionId: 'session', url: 'https://player.vimeo.com/video/test' }; throw mutateError === 'progress' ? unauthorized() : mutateError; } },
    '@/features/auth': { ...validation, ...hook }, './use-login-redirect': hook, './validation': validation,
    '@/features/account': { useProfile: () => profile, AccountShell: 'account' }, './use-profile': { useProfile: () => profile }, './account-shell': { AccountShell: 'account' },
    '@/components/site': { SiteHeader: 'header', SiteFooter: 'footer', Logo: 'logo', FormField: 'field', Checkbox: 'checkbox', ConfirmationDialog: 'dialog', ResultScreen: 'result', useTermsDraft: (_key, initial) => [draft ? draft(initial) : initial, () => {}] },
    '@/app/providers': { useMockReady: () => true }, './api': {}, './orders-api': {}, './profile-image': {}, './video-player': { VideoPlayer: 'video' },
    '@/features/manage': { AdminCourseActions: 'admin' }, './refund-copy': { refundSections: [] },
    './checkout': { checkout: async () => { requests.push('checkout'); throw mutateError; } },
  };
  return {
    routes, writes, requests, refetches, events, hook,
    render(file, name, props = {}) { return load(file, modules, globals)[name](props); },
    flush() { for (const effect of effects.splice(0)) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); } },
    unmount() { for (const cleanup of cleanups.splice(0)) cleanup(); },
  };
}
function find(node, predicate) {
  if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean);
  if (!node || typeof node !== 'object') return undefined;
  return predicate(node) ? node : find(node.props?.children, predicate);
}
const expectLogin = context => assert.deepEqual(context.routes, [['replace', '/login']]);

test('redirect checks every error, preserves non-auth errors and ignores late responses after leaving', () => {
  const context = runtime();
  const result = context.hook.useLoginRedirect(serverError(), unauthorized());
  assert.equal(result.requiresLogin, true);
  assert.deepEqual(context.routes, []);
  context.flush();
  expectLogin(context);
  assert.equal(result.redirectIfUnauthorized(forbidden()), false);
  context.unmount();
  assert.equal(result.redirectIfUnauthorized(unauthorized()), true);
  expectLogin(context);
});

for (const [file, name, props, pathname] of [
  ['classroom/classroom-screen', 'ClassroomScreen', {}, '/classroom'],
  ['classroom/viewer-screen', 'ViewerScreen', { courseId: 'course' }, '/classroom/courses/course'],
  ['account/orders-screen', 'OrdersScreen', {}, '/orders/order/refund'],
  ['account/profile-screen', 'ProfileScreen', {}, '/profile'],
]) {
  test(`${name} redirects unauthenticated reads while retaining other error UI`, () => {
    const targets = name === 'ProfileScreen' ? ['profileError'] : name === 'OrdersScreen' ? ['error', 'profileError', 'quoteError'] : ['error', 'profileError'];
    for (const target of targets) {
      const context = runtime({ [target]: unauthorized(), pathname });
      assert.equal(context.render(`src/features/${file}.tsx`, name, props), null);
      context.flush();
      expectLogin(context);
    }
    const context = runtime({ error: forbidden(), profileError: forbidden(), pathname });
    assert.notEqual(context.render(`src/features/${file}.tsx`, name, props), null);
    context.flush();
    assert.deepEqual(context.routes, []);
  });
}

test('payment confirmation sends session expiry only to login and retains the existing failure destination otherwise', () => {
  for (const error of [unauthorized(), serverError()]) {
    const context = runtime({ error });
    context.render('src/features/payments/payment-result.tsx', 'PaymentResult', { paymentKey: 'key', orderId: 'order', amount: '100' });
    context.flush();
    assert.deepEqual(context.routes, http.isUnauthorized(error) ? [['replace', '/login']] : [['location', '/payments/failure']]);
  }
});

test('expired checkout goes to login while genuine checkout failures retain the failure screen', async () => {
  for (const error of [unauthorized(), forbidden()]) {
    const context = runtime({ data: { id: 'course', title: '강의', price: 100, tags: [], chapters: [], reviews: [], selling: true, profile: { name: '회원' } }, mutateError: error });
    const tree = context.render('src/features/catalog/product-detail.tsx', 'ProductDetailScreen', { slug: 'course', kind: 'vod' });
    context.flush();
    find(tree, node => node.props.children === '수강 신청하기').props.onClick({ preventDefault() {} });
    await settle();
    assert.deepEqual(context.routes, http.isUnauthorized(error) ? [['replace', '/login']] : [['push', '/payments/failure?kind=vod']]);
    assert.deepEqual(context.requests, ['checkout']);
  }
});

test('PDF download and hide stop on session expiry without retrying the classroom query', async () => {
  for (const hiding of [false, true]) {
    const context = runtime({ data: { count: 1, items: [{ id: 'item', orderId: 'order', title: '교재', kind: 'pdf', expired: false }] }, state: value => value === null && hiding ? 'item' : value });
    const tree = context.render('src/features/classroom/classroom-screen.tsx', 'ClassroomScreen');
    context.flush();
    if (hiding) find(tree, node => node.type === 'dialog').props.actions.find(action => action.label === '삭제').onClick();
    else find(tree, node => node.props.children === 'PDF 다운로드').props.onClick();
    await settle();
    expectLogin(context);
    assert.deepEqual(context.refetches, []);
    assert.deepEqual(context.requests, [hiding ? 'classroom/item/hide' : 'orders/order/download']);
  }
});

test('an expired refund request navigates to login instead of refetching the quote', async () => {
  const context = runtime({ pathname: '/orders/order/refund', data: { count: 0, items: [] }, quote: { title: '강의', text: '환불', quote: {}, token: 'token' } });
  const tree = context.render('src/features/account/orders-screen.tsx', 'OrdersScreen');
  context.flush();
  find(tree, node => node.type === 'dialog').props.actions.find(action => action.label === '환불').onClick();
  await settle();
  expectLogin(context);
  assert.deepEqual(context.refetches, []);
});

test('profile save and image upload navigate on session expiry without advancing to another mutation', async () => {
  for (const image of [false, true]) {
    const context = runtime({ draft: initial => ({ ...initial, values: { ...initial.values, name: '변경된 이름' }, ...(image ? { imageChanged: true, selectedFile: { preview: 'data:image/png;base64,AA==', name: 'image.png' } } : {}) }) });
    const screen = context.render('src/features/account/profile-screen.tsx', 'ProfileScreen');
    const formNode = find(screen, node => typeof node.type === 'function');
    const form = formNode.type(formNode.props);
    context.flush();
    await form.props.onSubmit({ preventDefault() {} });
    expectLogin(context);
    assert.deepEqual(context.requests, [image ? 'profile/image' : 'profile']);
    assert.ok(!context.writes.includes(http.requestFailure));
  }
});

test('expired password reset redirects while invalid login credentials stay in the existing form', async () => {
  for (const kind of ['reset', 'login']) {
    const context = runtime({ mutateError: kind === 'reset' ? unauthorized() : new http.RequestError('invalid_credentials', 'password', 401), draft: initial => ({ ...initial, values: { ...initial.values, email: 'test@example.com', password: 'test-password', confirmation: 'test-password' } }) });
    const tree = context.render('src/features/auth/auth-form.tsx', 'AuthForm', { kind });
    context.flush();
    await find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {} });
    if (kind === 'reset') expectLogin(context);
    else {
      assert.deepEqual(context.routes, []);
      assert.ok(context.writes.some(value => value?.password === '이메일 또는 비밀번호를 확인해주세요.'));
    }
  }
});

test('playback start and progress handle session expiry without turning it into a playback failure', async () => {
  for (const progress of [false, true]) {
    const context = runtime({ mutateError: progress ? 'progress' : unauthorized() });
    const tree = context.render('src/features/classroom/video-player.tsx', 'VideoPlayer', { orderId: 'order', lessonId: 'lesson' });
    tree.props.ref.current = {};
    context.flush();
    await settle();
    if (progress) { context.events.timeupdate({ seconds: 10 }); await settle(); }
    expectLogin(context);
    assert.ok(!context.writes.includes(true));
    context.unmount();
  }
});
