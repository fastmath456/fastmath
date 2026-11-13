import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, overrides = {}) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { exports, require: name => name in overrides ? overrides[name] : require(name) });
  return exports;
}
const { BasicInformation } = load('src/features/manage/basic-information.tsx', {
  './validation': load('src/features/manage/validation.ts'), './basic-information.module.css': {},
  'next/image': props => React.createElement('img', { src: props.src, alt: props.alt }),
});

test('detail images hide upload text while thumbnail/material status and image errors remain visible', () => {
  const asset = { id: 'image', name: 'image.png', url: '/image.png', status: 'uploading' };
  const html = renderToStaticMarkup(React.createElement(BasicInformation, {
    basic: { title: '', basePrice: '', price: '', licenseDays: '', displayOrder: '', thumbnail: null,
      detailImages: [asset], materials: [{ ...asset, id: 'material', name: 'book.pdf' }], reviews: [] },
    errors: {}, uploading: { thumbnail: true, detailImage: true }, uploadErrors: { detailImage: '이미지 오류' },
  }));
  const detailList = html.match(/<ul aria-label="첨부된 상세이미지">(.*?)<\/ul>/s)?.[1];
  assert.ok(detailList);
  assert.ok(!detailList.includes('업로드 중'));
  assert.equal((html.match(/업로드 중\.\.\./g) ?? []).length, 1);
  assert.equal((html.match(/>업로드 중<\/p>/g) ?? []).length, 1);
  assert.ok(html.includes('이미지 오류'));
});
