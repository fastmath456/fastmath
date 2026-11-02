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
    ...modules, '@tanstack/react-query': { useQuery: options => options },
  }, globals);
  for (const read of [() => classroom.getClassroom(), () => classroom.getViewer('course'), () => orders.getOrders(), () => orders.getRefundQuote('order'), () => profile.useProfile().queryFn()]) {
    await assert.rejects(read(), http.isUnauthorized);
  }
  assert.deepEqual(calls, ['/api/classroom', '/api/classroom/courses/course', '/api/orders', '/api/orders/order/refund-quote', '/api/profile']);
});

test('all frontend reads use the real API without a mock worker or environment mode', async () => {
  const calls = [], data = { items: [], count: 0, kind: 'vod', title: '강의', reviews: [], chapters: [], price: 100, orderId: 'order', text: '환불 정보', name: '회원', email: 'test@example.com', image: '', avatar: '', birthday: '20000101', phone: '01012345678', marketing: false };
  const globals = { fetch: async path => { calls.push(path); return Response.json(data); }, process: { env: { NODE_ENV: 'development', NEXT_PUBLIC_API_MODE: 'mock' } } };
  const realHttp = load('src/lib/http.ts', {}, globals), modules = { '@/lib/http': realHttp };
  assert.equal('isMockMode' in realHttp, false);
  assert.equal('dataPath' in realHttp, false);
  const catalog = load('src/features/catalog/api.ts', modules, globals);
  const classroom = load('src/features/classroom/api.ts', modules, globals);
  const orders = load('src/features/account/orders-api.ts', modules, globals);
  const profile = load('src/features/account/use-profile.ts', { ...modules, '@tanstack/react-query': { useQuery: options => options } }, globals);
  await catalog.getProducts('price-asc');
  await catalog.getProduct('course name', 'vod');
  await classroom.getClassroom();
  await classroom.getViewer('course', true, 'lesson 1');
  await orders.getOrders();
  await orders.getRefundQuote('order');
  await profile.useProfile().queryFn();
  assert.deepEqual(calls, ['/api/products?sort=price-asc', '/api/products/course%20name', '/api/classroom', '/api/classroom/courses/course/preview?lesson=lesson%201', '/api/orders', '/api/orders/order/refund-quote', '/api/profile']);
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
function runtime({ error = null, profileError = null, quoteError = null, data, quote, pending = false, quotePending = false, profilePending = false, pathname = '/classroom', mutateError = unauthorized(), draft, state } = {}) {
  const routes = [], effects = [], cleanups = [], writes = [], requests = [], refetches = [], events = {}, players = [], draftWrites = [];
  const router = { replace: path => routes.push(['replace', path]), push: path => routes.push(['push', path]), refresh() {} };
  const react = {
    useId: () => 'test-menu', useEffect: effect => effects.push(effect), useCallback: callback => callback, useRef: value => ({ current: value }),
    useState: value => [state ? state(value) : typeof value === 'function' ? value() : value, next => writes.push(next)],
    Fragment: 'fragment',
  };
  const globals = {
    location: { hash: '', replace: path => routes.push(['location', path]) },
    window: { addEventListener() {}, removeEventListener() {}, Vimeo: { Player: class { constructor(_container, options) { players.push(options); } on(name, callback) { events[name] = callback; } ready() { return new Promise(resolve => { events.ready = resolve; }); } async destroy() {} } } },
    document: { addEventListener() {}, removeEventListener() {}, getElementById: () => null, createElement: () => ({}), head: { append: script => queueMicrotask(() => script.onload()) } },
    performance: { now: () => 6000 }, crypto: { randomUUID: () => 'test-request-key' },
    fetch: async () => new Response('image'),
  };
  const hook = load('src/features/auth/use-login-redirect.ts', { react, 'next/navigation': { useRouter: () => router }, '@/lib/http': http });
  const profile = { isPending: profilePending, error: profileError, data: profilePending ? undefined : { name: '테스트', email: 'test@example.com', birthday: '20000101', phone: '01012345678', image: '', avatar: '', marketing: false, revision: 1 } };
  const query = { isPending: pending, error, isError: Boolean(error), data, refetch: () => refetches.push('query') };
  const modules = {
    react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'fragment' },
    'next/navigation': { useRouter: () => router, usePathname: () => pathname }, 'next/image': 'image', 'next/link': 'link',
    '@tanstack/react-query': { useQuery: options => options.queryKey[0] === 'refund-quote' ? { isPending: quotePending, error: quoteError, isError: Boolean(quoteError), data: quote, refetch: () => refetches.push('quote') } : query, useQueryClient: () => ({ cancelQueries: async () => { writes.push('cancel-queries'); }, clear() { writes.push('clear-cache'); }, invalidateQueries: async () => {} }) },
    '@/lib/http': { ...http, mutate: async path => { requests.push(path); if (mutateError === null) return { ok: true }; if (path === 'playback' && mutateError === 'progress') return { sessionId: 'session', url: 'https://player.vimeo.com/video/test' }; throw mutateError === 'progress' ? unauthorized() : mutateError; } },
    '@/features/auth': { ...validation, ...hook }, './use-login-redirect': hook, './validation': validation,
    '@/features/account': { useProfile: () => profile, AccountShell: 'account' }, './use-profile': { useProfile: () => profile }, './account-shell': { AccountShell: 'account' },
    '@/components/site': { SiteHeader: 'header', SiteFooter: 'footer', Logo: 'logo', FormField: 'field', Checkbox: 'checkbox', Skeleton: 'skeleton', ConfirmationDialog: 'dialog', ResultScreen: 'result', useTermsDraft: (_key, initial) => { const current = draft ? draft(initial) : initial; return [current, next => draftWrites.push(typeof next === 'function' ? next(current) : next)]; } },
    './api': { parseSort: value => value ?? 'latest', downloadMaterials: async orderId => { requests.push(`orders/${orderId}/download`); throw mutateError; } }, './orders-api': {}, './profile-image': {}, './video-player': { VideoPlayer: 'video' },
    '@/features/manage': { AdminCourseActions: 'admin' }, './refund-copy': { refundSections: [] },
    './skeleton': { Skeleton: 'skeleton' }, './mobile-menu': { MobileMenu: 'mobile-menu' },
    './product-skeletons': { ProductDetailLoading: 'product-loading', ProductListSkeleton: 'list-loading' },
    './classroom-skeletons': { ViewerLoading: 'viewer-loading', ClassroomSkeleton: 'classroom-loading' },
    './account-skeletons': { OrdersSkeletonRows: 'orders-loading', ProfileLoading: 'profile-loading', RefundQuoteSkeleton: 'quote-loading' },
    './checkout': { checkout: async () => { requests.push('checkout'); throw mutateError; } },
    '@/features/catalog': { checkout: async () => { requests.push('checkout'); throw mutateError; } },
  };
  return {
    routes, writes, requests, refetches, events, players, hook, draftWrites,
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

test('profile blocks a name over the server raw 80-character limit before saving', async () => {
  const context = runtime({ draft: initial => ({ ...initial, values: { ...initial.values, name: ` ${'가'.repeat(80)}` } }) });
  const screen = context.render('src/features/account/profile-screen.tsx', 'ProfileScreen');
  const formNode = find(screen, node => typeof node.type === 'function');
  const form = formNode.type(formNode.props);
  await form.props.onSubmit({ preventDefault() {}, currentTarget: { querySelector: () => ({ focus() {} }) } });
  assert.deepEqual(context.requests, []);
  assert.ok(context.writes.some(value => value?.name === '이름은 80자 이하로 입력해주세요.'));
});

test('profile allows the raw 30-character phone limit and blocks a longer value before saving', async () => {
  for (const [phone, requests, error] of [
    [`010-1234-5678${' '.repeat(17)}`, ['profile'], undefined],
    [`010-1234-5678${' '.repeat(18)}`, [], '연락처는 30자 이하로 입력해주세요.'],
  ]) {
    const context = runtime({ draft: initial => ({ ...initial, values: { ...initial.values, name: '변경된 이름', phone } }) });
    const screen = context.render('src/features/account/profile-screen.tsx', 'ProfileScreen');
    const formNode = find(screen, node => typeof node.type === 'function');
    const form = formNode.type(formNode.props);
    await form.props.onSubmit({ preventDefault() {}, currentTarget: { querySelector: () => ({ focus() {} }) } });
    assert.deepEqual(context.requests, requests);
    if (error) assert.ok(context.writes.some(value => value?.phone === error));
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

test('signup accepts digits only and formats 11-digit phone numbers while editing', () => {
  for (const [field, previous, raw, cursor, inputType, expected, expectedCursor] of [
    ['birthday', '', '20a01-02', 8, 'insertText', '200102', 6],
    ['phone', '', '010abc123456789', 15, 'insertFromPaste', '010-1234-5678', 13],
    ['phone', '010-1234-5678', '0101234-5678', 3, 'deleteContentBackward', '011-2345-678', 2],
    ['phone', '010-1234-5678', '0101234-5678', 3, 'deleteContentForward', '010-2345-678', 3],
    ['phone', '010-1234-5678', '010-19234-5678', 6, 'insertText', '010-1923-4567', 6],
  ]) {
    const context = runtime({ draft: initial => ({ ...initial, values: { ...initial.values, [field]: previous } }) });
    const tree = context.render('src/features/auth/auth-form.tsx', 'AuthForm', { kind: 'signup' });
    const input = { value: raw, selectionStart: cursor, setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; } };
    find(tree, node => node.type === 'field' && node.props.name === field).props.onChange({ currentTarget: input, nativeEvent: { inputType } });
    assert.equal(input.value, expected);
    assert.equal(input.selectionStart, expectedCursor);
    assert.equal(context.draftWrites[0].values[field], expected);
  }
  const values = { phone: '010-123-4567' };
  assert.equal(validation.validateField('phone', values, 'signup'), '연락처 11자리를 입력해주세요.');
  assert.equal(validation.validateField('phone', values, 'recovery'), undefined);
  assert.equal(validation.validateField('phone', { phone: '010-1234-5678' }, 'signup'), undefined);
});

test('auth forms validate password minimum length and server field limits before submit', () => {
  const values = { email: 'test@example.com', password: '1234567', confirmation: '1234567', name: '테스트', birthday: '20000101', phone: '010-1234-5678' };
  assert.equal(validation.validateField('password', values, 'login'), '비밀번호는 8자 이상 입력해주세요.');
  assert.equal(validation.validateField('password', { ...values, password: 'a'.repeat(129) }, 'reset'), '비밀번호는 128자 이하로 입력해주세요.');
  assert.equal(validation.validateField('confirmation', { ...values, password: 'a'.repeat(128), confirmation: 'a'.repeat(129) }, 'signup'), '비밀번호는 128자 이하로 입력해주세요.');
  assert.equal(validation.validateField('email', { ...values, email: `${'a'.repeat(190)}@example.com` }, 'signup'), '이메일은 200자 이하로 입력해주세요.');
  assert.equal(validation.validateField('name', { ...values, name: '가'.repeat(201) }, 'signup'), '이름은 200자 이하로 입력해주세요.');
  assert.equal(validation.validateField('phone', { ...values, phone: `010-1234-5678${' '.repeat(188)}` }, 'recovery'), '연락처는 200자 이하로 입력해주세요.');
  assert.equal(validation.validateField('name', { ...values, name: '가'.repeat(201) }), undefined);
});

test('login blocks a short password before sending an authentication request', async () => {
  const context = runtime({ mutateError: null, draft: initial => ({ ...initial, values: { ...initial.values, email: 'test@example.com', password: '1234567' } }) });
  const tree = context.render('src/features/auth/auth-form.tsx', 'AuthForm', { kind: 'login' });
  await find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {}, currentTarget: { querySelector: () => ({ focus() {} }) } });
  assert.deepEqual(context.requests, []);
  assert.ok(context.writes.some(value => value?.password === '비밀번호는 8자 이상 입력해주세요.'));
});

test('signup enforces 11 phone digits at the server boundary', async () => {
  class ApiError extends Error { constructor(status, code, field) { super(code); Object.assign(this, { status, code, field }); } }
  const auth = load('src/server/auth.ts', {
    'next/server': {}, '../features/auth': validation,
    './http': { ApiError, body: async request => request, string: value => value, limit: async () => {}, setting: () => 'https://example.com' },
  });
  const input = { email: 'test@example.com', password: 'password', confirmation: 'password', name: '테스트', birthday: '20000101', phone: '010-123-4567', agreements: [true, true, true, false] };
  let savedPhone;
  const ctx = { params: { action: 'signup' }, request: input, db: { auth: { signUp: async options => { savedPhone = options.options.data.phone; return { data: { user: { identities: [{}] } } }; } } } };
  await assert.rejects(auth.authenticate(ctx), error => error.status === 400 && error.field === 'phone');
  input.phone = '010-1234-5678';
  assert.equal((await auth.authenticate(ctx)).ok, true);
  assert.equal(savedPhone, '01012345678');
});

test('playback start and progress handle session expiry without turning it into a playback failure', async () => {
  for (const progress of [false, true]) {
    const context = runtime({ mutateError: progress ? 'progress' : unauthorized() });
    const tree = context.render('src/features/classroom/video-player.tsx', 'VideoPlayer', { orderId: 'order', lessonId: 'lesson' });
    find(tree, node => node.props.ref).props.ref.current = {};
    context.flush();
    await settle();
    if (progress) { context.events.timeupdate({ seconds: 10 }); await settle(); }
    expectLogin(context);
    assert.ok(!context.writes.includes(true));
    context.unmount();
  }
});

const previewCourse = {
  id: 'course-id', title: '강의', price: 100, tags: [], reviews: [], selling: true, ownership: 'none',
  chapters: [{ id: 'generated-chapter-id', title: '첫 번째 챕터', lessons: [
    { id: 'free', title: '미리보기 강의', duration: '00:01:00', preview: true },
    { id: 'paid', title: '유료 강의', duration: '00:02:00', preview: false },
  ] }],
};
const isPaidLesson = node => node.type === 'button' && find(node.props.children, child => child.type === 'span' && child.props.children === '유료 강의');

test('product detail defaults to the first chapter and toggles chapters independently on desktop and mobile', () => {
  const data = { ...previewCourse, chapters: [...previewCourse.chapters, { id: 'second-chapter', title: '두 번째 챕터', lessons: [] }] };
  for (const viewport of ['desktop', 'mobile']) {
    let expanded = null;
    for (const [click, expected] of [[null, [true, false]], [1, [true, true]], [0, [false, true]], [1, [false, false]], [0, [true, false]]]) {
      let context = runtime({ data, state: value => value === null ? expanded : value });
      let tree = context.render('src/features/catalog/product-detail.tsx', 'ProductDetailScreen', { slug: 'course-slug', kind: 'vod' });
      if (click !== null) {
        find(tree, node => node.props['aria-controls'] === `${viewport}-content-${data.chapters[click].id}`).props.onClick();
        expanded = context.writes.at(-1);
        context = runtime({ data, state: value => value === null ? expanded : value });
        tree = context.render('src/features/catalog/product-detail.tsx', 'ProductDetailScreen', { slug: 'course-slug', kind: 'vod' });
      }
      data.chapters.forEach((chapter, index) => {
        const id = `${viewport}-content-${chapter.id}`;
        assert.equal(find(tree, node => node.props['aria-controls'] === id).props['aria-expanded'], expected[index]);
        assert.equal(Boolean(find(tree, node => node.props.id === id)), expected[index]);
      });
    }
  }
});

test('preview opens the selected lesson, unpaid lessons prompt, and owned lessons retain paid viewing', () => {
  for (const action of ['preview', 'unpaid', 'owned']) {
    const context = runtime({ data: { ...previewCourse, ownership: action === 'owned' ? 'owned' : 'none' } });
    const tree = context.render('src/features/catalog/product-detail.tsx', 'ProductDetailScreen', { slug: 'course-slug', kind: 'vod' });
    const button = action === 'preview' ? find(tree, node => node.props.children === '미리보기') : find(tree, isPaidLesson);
    button.props.onClick();
    if (action === 'unpaid') {
      assert.deepEqual(context.routes, []);
      assert.ok(context.writes.includes(true));
    } else assert.deepEqual(context.routes, [['push', `/classroom/courses/course-id?lesson=${action === 'preview' ? 'free&preview=1' : 'paid'}`]]);
  }
});

test('anonymous preview viewing remains available and paid selection keeps the preview in place', () => {
  const context = runtime({ profileError: unauthorized(), data: { ...previewCourse, courseId: 'course-id', recentLessonId: 'free', previewUrl: 'https://player.vimeo.com/video/123456' } });
  const tree = context.render('src/features/classroom/viewer-screen.tsx', 'ViewerScreen', { courseId: 'course-id', lessonId: 'free', preview: true });
  context.flush();
  assert.ok(tree);
  assert.deepEqual(context.routes, []);
  assert.equal(find(tree, node => node.type === 'video').props.previewUrl, 'https://player.vimeo.com/video/123456');
  find(tree, node => node.type === 'button' && node.props.children === '유료 강의').props.onClick();
  assert.ok(context.writes.includes(true));
  assert.deepEqual(context.routes, []);
});

test('preview payment prompt preserves the supplied copy and routes an expired checkout to login', async () => {
  const context = runtime({ data: { ...previewCourse, courseId: 'course-id', recentLessonId: 'free' }, state: value => value === false ? true : value });
  const tree = context.render('src/features/classroom/viewer-screen.tsx', 'ViewerScreen', { courseId: 'course-id', lessonId: 'free', preview: true });
  context.flush();
  const dialog = find(tree, node => node.type === 'dialog');
  assert.equal(dialog.props.label, '결제가 필요한 강의입니다.');
  assert.deepEqual(Array.from(dialog.props.children, child => child.props.children), ['결제가 필요한 강의입니다.', '다음 영상을 확인하시러면 결제가 필요합니다. 결제하시겠습니까?']);
  assert.deepEqual(Array.from(dialog.props.actions, action => action.label), ['취소', '결제']);
  dialog.props.onCancel();
  assert.ok(context.writes.includes(false));
  dialog.props.actions[1].onClick();
  await settle();
  expectLogin(context);
  assert.deepEqual(context.requests, ['checkout']);
});

test('preview player embeds its permitted video without creating paid playback or progress', async () => {
  const context = runtime();
  const url = 'https://player.vimeo.com/video/123456?h=unlistedhash&autoplay=0';
  const tree = context.render('src/features/classroom/video-player.tsx', 'VideoPlayer', { lessonId: 'free', previewUrl: url });
  find(tree, node => node.props.ref).props.ref.current = {};
  context.flush();
  await settle();
  assert.equal(context.players[0].url, url);
  assert.deepEqual(context.requests, []);
  assert.equal(context.events.timeupdate, undefined);
  assert.equal(tree.props['aria-busy'], true);
  context.events.ready();
  await settle();
  assert.ok(context.writes.includes(url));
  context.unmount();
  const writes = context.writes.length;
  context.events.ready();
  assert.equal(context.writes.length, writes);
});

test('an anonymous preview visitor choosing payment goes to login without starting checkout', () => {
  const context = runtime({ profileError: unauthorized(), data: { ...previewCourse, courseId: 'course-id', recentLessonId: 'free' }, state: value => value === false ? true : value });
  const tree = context.render('src/features/classroom/viewer-screen.tsx', 'ViewerScreen', { courseId: 'course-id', lessonId: 'free', preview: true });
  find(tree, node => node.type === 'dialog').props.actions[1].onClick();
  assert.deepEqual(context.routes, [['push', '/login']]);
  assert.deepEqual(context.requests, []);
});


test('pending data uses skeletons, while empty, error and cached results retain their existing states', () => {
  for (const [file, name, expected, props] of [
    ['catalog/product-list.tsx', 'ProductListScreen', 'list-loading', {}],
    ['catalog/product-detail.tsx', 'ProductDetailScreen', 'product-loading', { slug: 'course', kind: 'vod' }],
    ['classroom/classroom-screen.tsx', 'ClassroomScreen', 'classroom-loading', {}],
    ['account/orders-screen.tsx', 'OrdersScreen', 'orders-loading', {}],
    ['account/profile-screen.tsx', 'ProfileScreen', 'profile-loading', {}],
    ['classroom/viewer-screen.tsx', 'ViewerScreen', 'viewer-loading', { courseId: 'course', preview: true }],
  ]) {
    const context = runtime({ pending: true, profilePending: true });
    const tree = context.render('src/features/' + file, name, props);
    assert.ok(find(tree, node => node.type === expected), name);
    assert.deepEqual(context.routes, []);
  }
  for (const entry of [['catalog/product-list.tsx', 'ProductListScreen'], ['classroom/classroom-screen.tsx', 'ClassroomScreen'], ['account/orders-screen.tsx', 'OrdersScreen']]) {
    for (const options of [{ data: { count: 0, items: [] } }, { error: serverError() }]) {
      const context = runtime(options);
      const tree = context.render('src/features/' + entry[0], entry[1]);
      assert.equal(find(tree, node => /^(list|classroom|orders)-loading$/.test(node.type)), undefined);
      assert.ok(find(tree, node => node.type === 'p'));
    }
  }
  const cached = runtime({ data: { count: 1, items: [{ id: 'course', kind: 'vod', slug: 'course', title: '기존 강의', tags: [], price: 100 }] } });
  const tree = cached.render('src/features/catalog/product-list.tsx', 'ProductListScreen');
  assert.ok(find(tree, node => node.props.children === '기존 강의'));
  assert.equal(find(tree, node => node.type === 'list-loading'), undefined);
});

test('pending profile shows placeholders without first presenting a guest login link', () => {
  for (const name of ['SiteHeader', 'MobileMenu']) {
    const file = name === 'SiteHeader' ? 'site.tsx' : 'mobile-menu.tsx';
    const context = runtime({ state: value => value === false ? true : value });
    const pending = context.render('src/components/site/' + file, name, { profileLoading: true });
    assert.equal(find(pending, node => node.type === 'link' && node.props.children === '로그인/회원가입'), undefined);
    assert.ok(find(pending, node => node.type === 'skeleton'));
    const guest = context.render('src/components/site/' + file, name, { profileLoading: false });
    assert.ok(find(guest, node => node.type === 'link' && node.props.children === '로그인/회원가입'));
  }
});

test('refund quote stays skeletal and exposes no refund action before the quote arrives', () => {
  const context = runtime({ data: { count: 0, items: [] }, quotePending: true, pathname: '/orders/order-id/refund' });
  const tree = context.render('src/features/account/orders-screen.tsx', 'OrdersScreen');
  const dialog = find(tree, node => node.type === 'dialog');
  assert.ok(find(dialog, node => node.type === 'quote-loading'));
  assert.equal(dialog.props.actions.length, 0);
  assert.deepEqual(context.requests, []);
});

test('approved loading counts are eight products, three classroom cards and three order rows', () => {
  for (const [file, name, count] of [
    ['catalog/product-skeletons.tsx', 'ProductListSkeleton', 8],
    ['classroom/classroom-skeletons.tsx', 'ClassroomSkeleton', 3],
    ['account/account-skeletons.tsx', 'OrdersSkeletonRows', 3],
  ]) {
    const tree = runtime().render('src/features/' + file, name);
    assert.equal(tree.props.children.length, count);
  }
});

test('admin data skeleton appears only after access succeeds and clears when data is ready', async () => {
  for (const accessError of [null, forbidden()]) {
    const slots = [], effects = [];
    let cursor = 0, allow, list, reads = 0;
    const access = new Promise((resolve, reject) => { allow = () => accessError ? reject(accessError) : resolve(); });
    const listing = new Promise(resolve => { list = resolve; });
    const blank = () => ({ basic: {}, chapters: [], step: 1 });
    const modules = {
      react: {
        useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
        useRef: current => ({ current }), useCallback: callback => callback, useEffect: callback => effects.push(callback),
      },
      'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'fragment' },
      'next/image': 'image', 'next/navigation': { useRouter: () => ({ replace() {} }) },
      '@/components/site': { SiteFooter: 'footer' }, '@/lib/http': http,
      './api': { checkAccess: () => access, getDrafts: () => { reads++; return listing; } },
      './basic-information': { BasicInformation: 'basic' }, './curriculum-editor': {},
      './use-course-uploads': { useCourseUploads: () => ({}) },
      './validation': { emptyDocument: blank, validateBasic: () => ({}) },
      './manage-course-skeleton': { ManageCourseSkeleton: 'admin-loading' },
    };
    const { ManageCourseScreen } = load('src/features/manage/manage-course-screen.tsx', modules, { window: { history: { replaceState() {} } }, URLSearchParams });
    const render = () => { cursor = 0; return ManageCourseScreen({}); };
    assert.equal(render(), null);
    const cleanup = effects[0]();
    assert.equal(reads, 0);
    allow();
    await settle();
    if (accessError) {
      assert.equal(reads, 0);
      assert.equal(find(render(), node => node.type === 'admin-loading'), undefined);
    } else {
      assert.equal(render().type, 'admin-loading');
      assert.equal(reads, 1);
      list({ items: [] });
      await settle();
      assert.ok(find(render(), node => node.type === 'basic'));
    }
    cleanup();
  }
});


test('logout sends one request, clears cached account data and replaces the route with login', async () => {
  const context = runtime({ mutateError: null });
  const screen = context.render('src/features/account/profile-screen.tsx', 'ProfileScreen');
  const node = find(screen, item => typeof item.type === 'function');
  const form = node.type(node.props); context.flush();
  const action = find(form, item => item.props.children === '로그아웃');
  action.props.onClick(); action.props.onClick(); await settle();
  assert.deepEqual(context.requests, ['auth/logout']);
  expectLogin(context);
  assert.ok(context.writes.indexOf('cancel-queries') < context.writes.indexOf('clear-cache'));
});

test('withdrawal requires confirmation and submits only the signed-in account action', async () => {
  const context = runtime({ mutateError: null, state: value => value === false ? true : value });
  const screen = context.render('src/features/account/profile-screen.tsx', 'ProfileScreen');
  const node = find(screen, item => typeof item.type === 'function');
  const form = node.type(node.props); context.flush();
  const dialog = find(form, item => item.type === 'dialog' && item.props.label === '회원탈퇴 확인');
  assert.ok(dialog); assert.deepEqual(context.requests, []);
  assert.equal(dialog.props.actions[0].cancel, true);
  dialog.props.actions[1].onClick(); dialog.props.actions[1].onClick(); await settle();
  assert.deepEqual(context.requests, ['auth/withdraw']); expectLogin(context);
  assert.ok(context.writes.includes('clear-cache'));
});
