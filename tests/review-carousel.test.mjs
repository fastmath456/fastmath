import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync('src/features/landing/review-carousel.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
runInNewContext(source, { exports });

test('each card holds for 1.5 seconds and advances over 0.5 seconds in a two-second cycle', () => {
  const count = 3, duration = count * 2000;
  const frames = exports.reviewKeyframes(count);
  assert.equal(frames.length, 2 * count + 1);
  for (let index = 0; index < count; index++) {
    assert.equal(frames[index * 2 + 1].offset * duration, index * 2000 + 1500);
    assert.equal(frames[index * 2 + 2].offset * duration, (index + 1) * 2000);
    assert.equal(frames[index * 2 + 1].transform, `translateX(${-50 * index / count}%)`);
    assert.equal(frames[index * 2 + 2].transform, `translateX(${-50 * (index + 1) / count}%)`);
  }
  assert.equal(frames.at(-1).transform, 'translateX(-50%)');
});

test('a single review moves one full card group and returns seamlessly', () => {
  const frames = exports.reviewKeyframes(1);
  assert.equal(frames[1].offset, 0.75);
  assert.equal(frames[2].offset, 1);
  assert.equal(frames[2].transform, 'translateX(-50%)');
});
