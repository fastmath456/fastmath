import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function load(path) {
  const exports = {};
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  runInNewContext(outputText, { exports, encodeURIComponent });
  return exports;
}
const plain = value => JSON.parse(JSON.stringify(value));
const format = load('../src/features/manage/courses-format.ts');
const order = load('../src/features/manage/curriculum-order.ts');
const course = { id: 'course-1', status: 'selling', kind: 'vod', title: '수학1 개념 완성', slug: 'math-1', step: 1 };
const draft = { id: 'draft-1', status: 'draft', kind: 'vod', title: '', slug: null, step: 2 };

test('course rows link to the edit form and the public page; drafts reopen where they stopped', () => {
  assert.equal(format.courseEditHref(course), '/manage/courses/course-1/edit');
  assert.equal(format.courseViewHref(course), '/courses/math-1');
  assert.equal(format.courseViewHref({ ...course, kind: 'pdf' }), '/books/math-1');
  assert.equal(format.courseEditHref(draft), '/manage/courses/new?draft=draft-1&step=2');
  assert.equal(format.courseViewHref(draft), null);
  assert.equal(format.courseTitle(draft), '제목 없음');
});

test('course list filters by sale status and searches the title', () => {
  assert.equal(format.matchesCourse(course, 'all', ''), true);
  assert.equal(format.matchesCourse(course, 'stopped', ''), false);
  assert.equal(format.matchesCourse(draft, 'draft', ''), true);
  assert.equal(format.matchesCourse(course, 'all', ' 개념 '), true);
  assert.equal(format.matchesCourse(course, 'all', '미적분'), false);
});

const chapters = [
  { id: 'a', title: 'A', lessons: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }] },
  { id: 'b', title: 'B', lessons: [{ id: 'b1' }] },
  { id: 'c', title: 'C', lessons: [] },
];
const ids = list => plain(list).map(chapter => chapter.id + ':' + chapter.lessons.map(lesson => lesson.id).join(','));

test('chapters move one place and stay put at either end', () => {
  assert.deepEqual(ids(order.moveChapter(chapters, 'b', -1)), ['b:b1', 'a:a1,a2,a3', 'c:']);
  assert.deepEqual(ids(order.moveChapter(chapters, 'b', 1)), ['a:a1,a2,a3', 'c:', 'b:b1']);
  assert.equal(order.moveChapter(chapters, 'a', -1), chapters);
  assert.equal(order.moveChapter(chapters, 'c', 1), chapters);
  assert.equal(order.moveChapter(chapters, 'missing', 1), chapters);
  assert.deepEqual(ids(chapters), ['a:a1,a2,a3', 'b:b1', 'c:'], 'the input is not mutated');
});

test('lessons move only inside their own chapter', () => {
  assert.deepEqual(ids(order.moveLesson(chapters, 'a', 'a2', -1)), ['a:a2,a1,a3', 'b:b1', 'c:']);
  assert.deepEqual(ids(order.moveLesson(chapters, 'a', 'a2', 1)), ['a:a1,a3,a2', 'b:b1', 'c:']);
  assert.deepEqual(ids(order.moveLesson(chapters, 'a', 'a1', -1)), ids(chapters));
  assert.deepEqual(ids(order.moveLesson(chapters, 'a', 'a3', 1)), ids(chapters));
  assert.deepEqual(ids(order.moveLesson(chapters, 'b', 'a1', 1)), ids(chapters), 'a lesson of another chapter is ignored');
});
