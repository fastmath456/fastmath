import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync('src/features/landing/reviews.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
runInNewContext(source, { exports });

test('masks all but the first character while preserving an @ prefix', () => {
  for (const [input, expected] of [['@홍길동', '@홍**'], ['@ABCD', '@A***'], ['홍길동', '홍**'], ['@😀가나', '@😀**']]) {
    assert.equal(exports.maskReviewAuthor(input), expected);
  }
});

test('handles an empty name and a single-character name', () => {
  for (const input of ['', '@', '가', '@가']) assert.equal(exports.maskReviewAuthor(input), input);
});
