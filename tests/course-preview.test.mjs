import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function load(file, modules = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(source, { exports, URL, require: name => {
    if (!(name in modules)) throw new Error(`Unexpected dependency ${name}`);
    return modules[name];
  } });
  return exports;
}
const validation = load('src/features/manage/validation.ts');
class ApiError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
function fixture() {
  return {
    products: [{ id: 'course', kind: 'vod', title: '강의', poster: '/poster.png' }],
    chapters: [{ id: 'chapter', product_id: 'course', title: '첫 챕터', position: 0, active: true }],
    lessons: [
      { id: 'free', product_id: 'course', chapter_id: 'chapter', title: '미리보기', preview: true, active: true, position: 0, vimeo_url: 'https://vimeo.com/123456/unlistedhash' },
      { id: 'paid', product_id: 'course', chapter_id: 'chapter', title: '유료 강의', preview: false, active: true, position: 1, vimeo_url: 'https://vimeo.com/999999/paidsecret' },
      { id: 'other', product_id: 'other-course', chapter_id: 'other-chapter', preview: true, active: true, vimeo_url: 'https://vimeo.com/888888/othersecret' },
    ],
  };
}
function server(tables) {
  const queries = [];
  const db = { from(table) {
    const filters = [];
    let columns;
    function rows() {
      return tables[table].filter(row => filters.every(([key, value]) => row[key] === value))
        .map(row => Object.fromEntries(columns.split(',').map(key => [key, row[key]])));
    }
    const query = {
      select(value) { columns = value; return this; },
      eq(key, value) { filters.push([key, value]); return this; },
      order() { return this; },
      async maybeSingle() { return { data: rows()[0] ?? null, error: null }; },
      then(resolve, reject) { return Promise.resolve({ data: rows(), error: null }).then(resolve, reject); },
    };
    queries.push({ table, filters });
    return query;
  } };
  const http = { adminDb: () => db, ApiError, dbError: error => { if (error) throw error; }, string: (value, _field, max) => {
    if (typeof value !== 'string' || !value.length || value.length > max) throw new ApiError(400, 'invalid_field');
    return value;
  } };
  return { ...load('src/server/learning.ts', { './http': http, './orders': {}, '../features/manage/validation': validation, 'next/server': {}, './zip': {} }), queries };
}
function context(lesson = 'free') {
  return { params: { courseId: 'course' }, request: { nextUrl: new URL(`http://local.test/preview${lesson === null ? '' : `?lesson=${encodeURIComponent(lesson)}`}`) }, user: async () => { throw new ApiError(401, 'unauthorized'); } };
}

test('anonymous preview returns only the selected preview URL and public curriculum metadata', async () => {
  const code = server(fixture());
  const result = await code.previewViewer(context());
  assert.equal(result.previewUrl, 'https://player.vimeo.com/video/123456?h=unlistedhash&autoplay=0');
  assert.equal(result.recentLessonId, 'free');
  assert.equal(result.orderId, undefined);
  assert.equal(result.chapters[0].lessons[1].preview, false);
  assert.ok(!JSON.stringify(result).includes('paidsecret'));
  assert.ok(!JSON.stringify(result).includes('othersecret'));
  assert.ok(code.queries.at(-1).filters.some(([key, value]) => key === 'id' && value === 'free'));
});

test('paid, cross-course and missing lesson IDs cannot bypass preview access', async () => {
  for (const id of ['paid', 'other', 'missing']) {
    await assert.rejects(server(fixture()).previewViewer(context(id)), error => error.status === 403 && error.code === 'no_access');
  }
});

test('inactive lessons and chapters do not expose preview URLs', async () => {
  for (const table of ['lessons', 'chapters']) {
    const tables = fixture();
    tables[table][0].active = false;
    await assert.rejects(server(tables).previewViewer(context()), error => error.status === 403);
  }
});

test('missing course, unavailable video and invalid lesson input retain API error contracts', async () => {
  const missing = fixture(); missing.products = [];
  await assert.rejects(server(missing).previewViewer(context()), error => error.status === 404);
  const video = fixture(); video.lessons[0].vimeo_url = null;
  await assert.rejects(server(video).previewViewer(context()), error => error.status === 503 && error.code === 'video_unavailable');
  await assert.rejects(server(fixture()).previewViewer(context('x'.repeat(101))), error => error.status === 400);
});

test('default preview selection finds the first preview while the original viewer stays protected', async () => {
  const code = server(fixture());
  assert.equal((await code.previewViewer(context(null))).recentLessonId, 'free');
  await assert.rejects(code.viewer(context()), error => error.status === 401);
});

test('only the first lesson is public even when stored preview flags say otherwise', async () => {
  const tables = fixture();
  tables.lessons[0].preview = false;
  tables.lessons[1].preview = true;
  const code = server(tables);
  const result = await code.previewViewer(context());
  assert.equal(result.chapters[0].lessons[0].preview, true);
  assert.equal(result.chapters[0].lessons[1].preview, false);
  await assert.rejects(code.previewViewer(context('paid')), error => error.status === 403);
});

test('first lesson follows chapter order, skips empty chapters, and ignores hidden lessons', async () => {
  const tables = fixture();
  tables.chapters.unshift({ id: 'empty', product_id: 'course', title: '빈 챕터', active: true, position: 0 });
  tables.chapters.push({ id: 'second', product_id: 'course', title: '다음 챕터', active: true, position: 2 });
  tables.lessons.unshift({ id: 'later', product_id: 'course', chapter_id: 'second', title: '다음 챕터 첫 차시', active: true, preview: true, position: 0 });
  const result = await server(tables).previewViewer(context(null));
  assert.equal(result.recentLessonId, 'free');
  await assert.rejects(server(tables).previewViewer(context('later')), error => error.status === 403);
});
