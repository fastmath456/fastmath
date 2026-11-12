import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync('src/features/manage/use-course-uploads.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const flush = () => new Promise(resolve => setImmediate(resolve));
function runtime() {
  let document = { basic: { detailImages: [], materials: [] } }, cursor = 0;
  const slots = [], requests = [], cleanup = [];
  const react = {
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useState(value) { const i = cursor++; slots[i] ??= { value }; return [slots[i].value, next => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next; }]; },
    useCallback(fn) { return fn; },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((value, j) => value !== slots[i][j])) { slots[i] = deps; const stop = fn(); if (stop) cleanup.push(stop); } },
  };
  const module = { exports: {} }, nativeRequire = createRequire(import.meta.url);
  const require = id => id === 'react' ? react : id === './api' ? { uploadAsset: (slot, file, signal) => new Promise((resolve, reject) => requests.push({ slot, file, signal, resolve, reject })) } : nativeRequire(id);
  runInNewContext(source, { require, exports: module.exports, module, crypto, AbortController, createImageBitmap: async () => ({ close() {} }) });
  const render = () => { cursor = 0; return module.exports.useCourseUploads(document, update => { document = update(document); }); };
  const complete = index => requests[index].resolve({ asset: { id: `saved-${index}`, name: requests[index].file.name, url: `/image/${index}`, type: 'image/png', size: 1 } });
  return { render, requests, complete, get document() { return document; }, unmount: () => cleanup.forEach(fn => fn()) };
}
const file = name => new File(['image'], name, { type: 'image/png' });

test('detail uploads keep selection order even when responses finish out of order', async () => {
  const r = runtime();
  r.render().onUpload('detailImage', [file('first.png'), file('second.png')]);
  r.render().onUpload('detailImage', [file('third.png')]);
  await flush();
  r.complete(2); r.complete(1); await flush(); r.complete(0); await flush();
  assert.deepEqual(Array.from(r.document.basic.detailImages, asset => asset.name), ['first.png', 'second.png', 'third.png']);
  assert.equal(r.render().pending, false);
  r.render().onRemoveDetailImage('saved-1');
  assert.deepEqual(Array.from(r.document.basic.detailImages, asset => asset.name), ['first.png', 'third.png']);
  r.unmount();
});

test('deleting an in-flight image aborts it and a late response cannot restore it', async () => {
  const r = runtime(); r.render().onUpload('detailImage', [file('first.png'), file('second.png')]);
  await flush(); const id = r.document.basic.detailImages[0].id;
  r.render().onRemoveDetailImage(id);
  assert.equal(r.requests[0].signal.aborted, true);
  r.complete(0); r.complete(1); await flush();
  assert.deepEqual(Array.from(r.document.basic.detailImages, asset => asset.name), ['second.png']);
  r.unmount();
});

test('failed uploads retain their position and retry there; reset ignores stale completions', async () => {
  const r = runtime(); r.render().onUpload('detailImage', [file('first.png'), file('second.png')]);
  await flush(); r.requests[0].reject(new Error('upload failed')); r.complete(1); await flush();
  let state = r.render(); assert.equal(state.failedDetailImages, true); assert.equal(state.pending, false);
  state.onRetryDetailImage(r.document.basic.detailImages[0].id); await flush(); r.complete(2); await flush();
  assert.deepEqual(Array.from(r.document.basic.detailImages, asset => asset.name), ['first.png', 'second.png']);
  assert.equal(r.render().failedDetailImages, false);
  r.render().onUpload('detailImage', [file('third.png')]); await flush();
  r.render().reset(); r.complete(3); await flush();
  assert.equal(r.document.basic.detailImages.some(asset => asset.id === 'saved-3'), false);
  r.unmount();
});
