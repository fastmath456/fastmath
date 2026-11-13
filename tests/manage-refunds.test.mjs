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
  runInNewContext(outputText, { exports, Intl, Date, Number });
  return exports;
}
const format = load('../src/features/manage/refunds-format.ts');
const item = { orderId: 'order-1', name: '홍길동', email: 'hong@example.test', title: '수학1 개념 완성', kind: 'vod', usedSeconds: 2520, totalSeconds: 36000, downloaded: false };

test('refund usage reads as watched minutes for courses and download state for books', () => {
  assert.equal(format.usage(item), '600분 중 42분');
  assert.equal(format.usage({ ...item, usedSeconds: 59 }), '시청 안 함');
  assert.equal(format.usage({ ...item, kind: 'pdf', downloaded: false }), '다운로드 안 함');
  assert.equal(format.usage({ ...item, kind: 'pdf', downloaded: true }), '다운로드함');
});

test('refund dates show Korea time', () => {
  assert.equal(format.shortDateTime('2026-11-13T05:02:00Z'), '11.13 14:02');
  assert.equal(format.dateTime('2026-11-12T09:21:07Z', true), '2026.11.12 18:21:07');
  assert.equal(format.date('2026-11-12T15:30:00Z'), '2026.11.13');
});

test('refund filters match status and search across name, email, order and product', () => {
  const review = { ...item, status: 'review' }, done = { ...item, orderId: 'order-2', name: '김민지', status: 'completed' };
  assert.deepEqual([review, done].filter(row => format.matches(row, 'review', '')), [review]);
  assert.deepEqual([review, done].filter(row => format.matches(row, 'all', '민지')), [done]);
  assert.deepEqual([review, done].filter(row => format.matches(row, 'all', 'ORDER-1')), [review]);
  assert.equal(format.matches(review, 'all', '개념'), true);
});

test('refund errors map to actionable messages with a generic fallback', () => {
  assert.match(format.refundErrorMessage('refund_mismatch'), /취소된 금액/);
  assert.match(format.refundErrorMessage('refund_downloaded'), /전자책/);
  assert.match(format.refundErrorMessage('payment_outcome_unknown'), /잠시 후 다시 확인/);
  assert.match(format.refundErrorMessage('constructor'), /일시적인 오류/);
  assert.match(format.refundErrorMessage(undefined), /일시적인 오류/);
});
