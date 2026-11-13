import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

function load(path, modules = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(source, { exports, Buffer, structuredClone, require: name => {
    if (name in modules) return modules[name];
    throw new Error(`Unexpected dependency ${name}`);
  } });
  return exports;
}
const order = load('src/features/manage/course-order.ts');
const plain = value => JSON.parse(JSON.stringify(value));

test('new course is placed into the existing list before it has a product ID', () => {
  assert.deepEqual(plain(order.initialProductOrder(['a', 'b'])), { baseline: ['a', 'b'], ids: ['a', 'b', null] });
  assert.deepEqual(plain(order.initialProductOrder([], undefined)), { baseline: [], ids: [null] });
});

test('editing replaces only the current card; reopening retains saved positions', () => {
  const initial = order.initialProductOrder(['a', 'b', 'c'], 'b');
  assert.deepEqual(plain(initial.ids), ['a', null, 'c']);
  const saved = { ...initial, ids: order.moveProduct(initial.ids, 1, 0) };
  assert.deepEqual(plain(initial.ids), ['a', null, 'c']);
  assert.equal(order.initialProductOrder(['a', 'b', 'c'], 'b', saved), saved);
  assert.deepEqual(plain(order.initialProductOrder(['c', 'a', 'b'], 'b', saved).ids), ['c', 'a', null]);
});

test('moving forward and backward preserves every card and rejects out-of-range moves', () => {
  const ids = ['a', null, 'b'];
  assert.deepEqual(plain(order.moveProduct(ids, 0, 2)), [null, 'b', 'a']);
  assert.deepEqual(plain(order.moveProduct(ids, 2, 0)), ['b', 'a', null]);
  assert.equal(order.moveProduct(ids, -1, 1), ids);
  assert.equal(order.moveProduct(ids, 1, 3), ids);
});

test('draft order rejects duplicates, invalid IDs, and missing or duplicate current cards', () => {
  assert.equal(order.validProductOrder({ baseline: ['a'], ids: [null, 'a'] }), true);
  for (const value of [null, {}, { baseline: ['a', 'a'], ids: [null, 'a'] }, { baseline: [], ids: [null, null] }, { baseline: ['a'], ids: ['a'] }, { baseline: [5], ids: [null] }, { baseline: [''], ids: [null] }, { baseline: [], ids: [null, {}] }]) {
    assert.equal(order.validProductOrder(value), false);
  }
});

class ApiError extends Error {
  constructor(status, code, field) { super(code); this.status = status; this.code = code; this.field = field; }
}
function server({ authorized = true, error = null, ordered = true } = {}) {
  const calls = [];
  const api = load('src/server/manage.ts', {
    'server-only': {}, 'node:crypto': {}, sharp: {}, 'next/server': {},
    '../features/manage/validation': {}, '../features/manage/course-order': order,
    './http': {
      ApiError, bytes: async request => Buffer.from(await request.text()),
      requireAdmin: async () => { if (!authorized) throw new ApiError(403, 'forbidden'); return { id: 'admin' }; },
      adminDb: () => ({ from: () => { const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { document: ordered ? { productOrder: { baseline: [], ids: [null] } } : {} }, error: null }) }; return query; }, rpc: async (...args) => { calls.push(args); return { data: [{ course_id: 'new', slug: 'new' }], error }; } }),
      dbError: () => { throw new Error('unexpected db error'); },
    },
  });
  return { api, calls };
}
const context = data => ({ params: { id: '11111111-1111-4111-8111-111111111111' }, request: new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }) });

test('publishing calls the atomic transaction only after admin authorization', async () => {
  const allowed = server();
  assert.deepEqual(plain(await allowed.api.publishCourseDraft(context({ revision: 2 }))), { courseId: 'new', slug: 'new' });
  assert.deepEqual(plain(allowed.calls), [['publish_ordered_course_draft', { p_owner: 'admin', p_draft: '11111111-1111-4111-8111-111111111111', p_revision: 2 }]]);
  const denied = server({ authorized: false });
  await assert.rejects(denied.api.publishCourseDraft(context({ revision: 2 })), { status: 403 });
  assert.equal(denied.calls.length, 0);
});

test('a concurrent ordering conflict returns 409 without a retry or partial fallback', async () => {
  const { api, calls } = server({ error: { message: 'order_conflict' } });
  await assert.rejects(api.publishCourseDraft(context({ revision: 1 })), { status: 409, code: 'order_conflict' });
  assert.equal(calls.length, 1);
});

test('invalid ordering is rejected before saving any draft', async () => {
  const { api, calls } = server();
  await assert.rejects(api.createCourseDraft(context({ document: { basic: {}, productOrder: { baseline: [], ids: [null, null] } } })), { status: 400, field: 'productOrder' });
  assert.equal(calls.length, 0);
});

test('legacy drafts retain the existing publisher when no ordering was selected', async () => {
  const { api, calls } = server({ ordered: false });
  await api.publishCourseDraft(context({ revision: 1 }));
  assert.equal(calls[0][0], 'publish_course_draft');
});

test('a malformed saved permutation cannot add unknown cards or omit existing cards', () => {
  const baseline = ['a', 'b'];
  for (const ids of [[null, 'unknown'], [null, 'a', 'b'], [null, null]]) {
    assert.deepEqual(plain(order.initialProductOrder(baseline, 'a', { baseline, ids }).ids), [null, 'b']);
  }
});
