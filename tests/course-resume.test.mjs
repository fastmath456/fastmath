import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { runInNewContext } from 'node:vm';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import ts from 'typescript';

const compiled = new Map();
function load(file, modules) {
  if (!compiled.has(file)) compiled.set(file, ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText);
  const exports = {};
  runInNewContext(compiled.get(file), { exports, require(name) {
    if (name.endsWith('.module.css')) return {};
    if (name in modules) return modules[name];
    throw new Error(`Unexpected dependency ${name}`);
  } });
  return exports;
}

class ApiError extends Error {
  constructor(status, code) { super(code); this.status = status; }
}
const progress = (lesson, completed, updated = '2026-11-10T01:00:00Z') => ({
  order_id: 'order', lesson_id: lesson, completed, updated_at: updated,
});
function fixture() {
  const tables = {
    entitlements: [{ user_id: 'user', product_id: 'course', order_id: 'order', revoked: false,
      starts_at: '2020-01-01T00:00:00Z', expires_at: '2099-01-01T00:00:00Z',
      products: { title: '두 강의', poster: '' }, orders: { status: 'paid' } }],
    order_lessons: ['first', 'second'].map(lesson_id => ({ order_id: 'order', lesson_id })),
    lesson_progress: [],
    chapters: [{ id: 'chapter', product_id: 'course', title: '챕터', position: 0 }],
    lessons: ['first', 'second'].map((id, position) => ({ id, product_id: 'course', chapter_id: 'chapter', title: id, position })),
  };
  const db = { from(table) {
    const filters = [], sorts = [];
    let columns, maximum = Infinity;
    function rows() {
      let data = tables[table].filter(row => filters.every(matches => matches(row)));
      for (const [key, ascending] of sorts) data.sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (ascending ? 1 : -1));
      data = data.slice(0, maximum);
      return columns.includes('(') ? data : data.map(row => Object.fromEntries(columns.split(',').map(key => [key, row[key]])));
    }
    return {
      select(value) { columns = value; return this; },
      eq(key, value) { filters.push(row => row[key] === value); return this; },
      lte(key, value) { filters.push(row => row[key] <= value); return this; },
      gt(key, value) { filters.push(row => row[key] > value); return this; },
      in(key, values) { filters.push(row => values.includes(row[key])); return this; },
      order(key, { ascending = true } = {}) { sorts.push([key, ascending]); return this; },
      limit(value) { maximum = value; return this; },
      async maybeSingle() { return { data: rows()[0] ?? null, error: null }; },
      then(resolve, reject) { return Promise.resolve({ data: rows(), error: null }).then(resolve, reject); },
    };
  } };
  const code = load('src/server/learning.ts', {
    './http': { adminDb: () => db, ApiError, dbError: error => { if (error) throw error; } },
    './orders': {}, '../features/manage/validation': {}, 'next/server': {}, './zip': {},
  });
  return { tables, viewer: () => code.viewer({ user: async () => ({ id: 'user' }), params: { courseId: 'course' } }) };
}

test('VOD entry advances from a completed first lesson to the second lesson', async () => {
  const context = fixture();
  context.tables.lesson_progress = [progress('first', true)];
  assert.equal((await context.viewer()).recentLessonId, 'second');
});

test('VOD entry keeps an unfinished recent lesson and the first lesson before any viewing', async () => {
  const context = fixture();
  assert.equal((await context.viewer()).recentLessonId, 'first');
  context.tables.lesson_progress = [progress('first', false)];
  assert.equal((await context.viewer()).recentLessonId, 'first');
  context.tables.lesson_progress.push(progress('second', false, '2026-11-10T02:00:00Z'));
  assert.equal((await context.viewer()).recentLessonId, 'second');
});

test('advancing follows chapter order and stays inside the purchased curriculum', async () => {
  const context = fixture();
  context.tables.chapters.push({ id: 'later', product_id: 'course', title: '다음 챕터', position: 1 });
  context.tables.lessons[0].position = 5;
  context.tables.lessons[1].chapter_id = 'later';
  context.tables.lessons[1].position = 0;
  context.tables.lessons.push({ id: 'not-purchased', product_id: 'course', chapter_id: 'chapter', title: '미구매 강의', position: 6 });
  context.tables.lesson_progress = [progress('first', true), { ...progress('not-purchased', true, '2026-11-10T03:00:00Z'), order_id: 'other-order' }];
  const result = await context.viewer();
  assert.equal(result.recentLessonId, 'second');
  assert.deepEqual(Array.from(result.chapters.flatMap(chapter => chapter.lessons.map(lesson => lesson.id))), ['first', 'second']);
});

test('completing the final or only lesson preserves the current lesson', async () => {
  const context = fixture();
  context.tables.lesson_progress = [progress('first', true), progress('second', true, '2026-11-10T02:00:00Z')];
  assert.equal((await context.viewer()).recentLessonId, 'second');
  context.tables.order_lessons = context.tables.order_lessons.slice(0, 1);
  context.tables.lesson_progress = [progress('first', true)];
  assert.equal((await context.viewer()).recentLessonId, 'first');
});

test('course entry still rejects revoked, expired, unpaid and another user access', async () => {
  for (const change of [{ revoked: true }, { expires_at: '2020-01-01T00:00:00Z' }, { orders: { status: 'refunded' } }, { user_id: 'other-user' }]) {
    const context = fixture();
    Object.assign(context.tables.entitlements[0], change);
    await assert.rejects(context.viewer(), error => error.status === 403);
  }
});

test('leaving and reopening VOD immediately fetches the updated resume lesson', async () => {
  let options, nextLesson = 'first', reads = 0;
  const jsx = (type, props) => ({ type, props });
  const screen = load('src/features/classroom/viewer-screen.tsx', {
    react: { useEffect() {}, useId: () => 'test', useRef: current => ({ current }), useState: value => [value, () => {}] },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'next/image': {}, 'next/link': {}, 'next/navigation': { useRouter: () => ({}) },
    '@tanstack/react-query': { useQuery: value => { options = value; return { isPending: true }; } },
    '@/lib/http': {}, '@/features/account': { useProfile: () => ({}) }, '@/features/catalog': {},
    '@/features/auth': { useLoginRedirect: () => ({}) }, '@/components/site': {},
    './video-player': {}, './classroom-skeletons': {},
    './api': { getViewer: async () => { reads++; return { recentLessonId: nextLesson }; } },
  });
  screen.ViewerScreen({ courseId: 'course' });
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: false } } });
  let unsubscribe;
  try {
    const first = new QueryObserver(client, options);
    unsubscribe = first.subscribe(() => {});
    assert.equal((await first.refetch()).data.recentLessonId, 'first');
    nextLesson = 'second';
    unsubscribe();
    await delay(10);
    const second = new QueryObserver(client, options);
    unsubscribe = second.subscribe(() => {});
    await delay(10);
    assert.equal(second.getCurrentResult().data.recentLessonId, 'second');
    assert.equal(reads, 2);
  } finally {
    unsubscribe?.();
    client.clear();
  }
});
