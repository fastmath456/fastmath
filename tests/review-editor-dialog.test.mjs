import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync('src/features/landing/review-editor-dialog.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;

function load(globals = {}, modules = {}) {
  const exports = {};
  runInNewContext(source, {
    exports,
    ...globals,
    require(name) {
      if (name in modules) return modules[name];
      if (name === 'react') return { useEffect() {}, useRef: value => ({ current: value }), useState: value => [value, () => {}] };
      if (name === 'react/jsx-runtime') return { jsx() {}, jsxs() {} };
      if (name === 'next/image' || name.endsWith('.module.css')) return {};
      if (name === '@/components/site') return {};
      if (name === '@/lib/http') return {};
      if (name === './review-image') return {};
      if (name === './reviews') return {};
      if (name === '../manage/basic-information.module.css') return {};
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return exports;
}

function find(node, predicate) {
  if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean);
  if (!node || typeof node !== 'object') return undefined;
  return predicate(node) ? node : find(node.props?.children, predicate);
}

function dialogRuntime({ reviews = [], decode = async () => ({ width: 4, height: 3, close() {} }) } = {}) {
  const hooks = [], calls = [];
  let index = 0;
  const react = {
    useRef(value) {
      const hook = index++;
      return hooks[hook] ??= { current: value };
    },
    useState(value) {
      const hook = index++;
      if (!(hook in hooks)) hooks[hook] = typeof value === 'function' ? value() : value;
      return [hooks[hook], next => { hooks[hook] = typeof next === 'function' ? next(hooks[hook]) : next; }];
    },
    useEffect() { index += 1; },
  };
  const component = load({
    FormData,
    URL: { createObjectURL: file => `blob:${file.name}`, revokeObjectURL() {} },
    createImageBitmap: decode,
  }, {
    react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'next/image': 'image',
    '@/components/site': { ConfirmationDialog: 'confirmation', FormField: 'field' },
    '@/lib/http': { mutate: async (...args) => { calls.push(args); return { review: { id: 'saved', author: '작성자', text: '본문', images: [] } }; } },
    './review-image': { ReviewImage: 'review-image' }, './reviews': {}, '../manage/basic-information.module.css': {}, './review-editor-dialog.module.css': {},
  });
  return {
    calls,
    render() { index = 0; return component.ReviewEditorDialog({ reviews, onClose() {}, onSaved() {} }); },
  };
}

function form(tree) { return find(tree, node => node.type === 'form'); }
function imageInput(tree) { return find(tree, node => node.type === 'input' && node.props.id === 'review-image'); }
function fillNewReview(runtime) {
  let tree = runtime.render();
  find(tree, node => node.type === 'field' && node.props.id === 'review-author').props.onChange({ target: { value: '작성자' } });
  find(tree, node => node.type === 'textarea').props.onChange({ target: { value: '본문' } });
  return runtime.render();
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('review image validation rejects empty and over-20MB files before decoding', async () => {
  let decodes = 0;
  const { reviewImageError } = load({ createImageBitmap: async () => { decodes += 1; return { close() {} }; } });
  assert.equal(await reviewImageError(new File([], 'empty.bin')), '비어 있지 않은 이미지를 선택해주세요.');
  assert.equal(await reviewImageError(new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'large.bin')), '원문 이미지는 20MB 이하로 선택해주세요.');
  assert.equal(decodes, 0);
});

test('review image validation accepts any browser-readable file without MIME or extension allowlists', async () => {
  let closed = 0;
  const { reviewImageError } = load({ createImageBitmap: async file => { assert.equal(file.name, 'original.any'); return { close() { closed += 1; } }; } });
  assert.equal(await reviewImageError(new File(['image'], 'original.any', { type: 'application/octet-stream' })), null);
  assert.equal(closed, 1);
});

test('review image validation matches the server 40,000,000-pixel limit', async () => {
  const atLimit = load({ createImageBitmap: async () => ({ width: 8_000, height: 5_000, close() {} }) });
  assert.equal(await atLimit.reviewImageError(new File(['image'], 'at-limit.any')), null);

  let closed = 0;
  const overLimit = load({ createImageBitmap: async () => ({ width: 8_001, height: 5_000, close() { closed += 1; } }) });
  assert.equal(await overLimit.reviewImageError(new File(['image'], 'over-limit.any')), '원문 이미지는 40,000,000픽셀 이하로 선택해주세요.');
  assert.equal(closed, 1);
});

test('review image validation reports unreadable files and falls back to image decoding', async () => {
  const failed = load({ createImageBitmap: async () => { throw new Error('decode failed'); } });
  assert.equal(await failed.reviewImageError(new File(['not an image'], 'source.file')), '이미지를 불러오지 못했습니다. 다른 파일을 선택해주세요.');

  const created = [], revoked = [];
  class BrowserImage {
    set src(value) { created.push(value); this.onload(); }
  }
  const fallback = load({
    URL: { createObjectURL: () => 'blob:preview', revokeObjectURL: value => revoked.push(value) },
    window: { Image: BrowserImage },
  });
  assert.equal(await fallback.reviewImageError(new File(['image'], 'source.file')), null);
  assert.deepEqual(created, ['blob:preview']);
  assert.deepEqual(revoked, ['blob:preview']);
});

test('new review submission keeps missing or invalid images out of the request and shows the image error', async () => {
  const missing = dialogRuntime();
  let tree = fillNewReview(missing);
  await form(tree).props.onSubmit({ preventDefault() {} });
  assert.equal(missing.calls.length, 0);
  tree = missing.render();
  assert.equal(find(tree, node => node.type === 'p' && node.props.role === 'alert').props.children, '원문 이미지를 선택해주세요.');

  const invalid = dialogRuntime({ decode: async () => { throw new Error('decode failed'); } });
  tree = fillNewReview(invalid);
  imageInput(tree).props.onChange({ target: { files: [new File(['not an image'], 'bad.any')] } });
  await settle();
  tree = invalid.render();
  await form(tree).props.onSubmit({ preventDefault() {} });
  assert.equal(invalid.calls.length, 0);
  tree = invalid.render();
  assert.equal(find(tree, node => node.type === 'p' && node.props.role === 'alert').props.children, '이미지를 불러오지 못했습니다. 다른 파일을 선택해주세요.');
});

test('existing review text edit submits without replacing its original image', async () => {
  const existing = { id: 'review-id', author: '작성자', text: '본문', images: [{ src: '/original.png', width: 4, height: 3 }] };
  const runtime = dialogRuntime({ reviews: [existing] });
  const tree = runtime.render();
  await form(tree).props.onSubmit({ preventDefault() {} });
  assert.equal(runtime.calls.length, 1);
  const [path, data, method] = runtime.calls[0];
  assert.equal(path, 'admin/landing/reviews/review-id');
  assert.equal(method, 'PATCH');
  assert.equal(data.get('image'), null);
});

test('new review submission waits for image decoding before sending the selected image', async () => {
  let decode;
  const runtime = dialogRuntime({ decode: () => new Promise(resolve => { decode = resolve; }) });
  let tree = fillNewReview(runtime);
  const file = new File(['image'], 'selected.any');
  imageInput(tree).props.onChange({ target: { files: [file] } });
  const submit = form(tree).props.onSubmit({ preventDefault() {} });
  await settle();
  assert.equal(runtime.calls.length, 0);
  decode({ width: 4, height: 3, close() {} });
  await submit;
  assert.equal(runtime.calls.length, 1);
  assert.equal(runtime.calls[0][1].get('image').name, 'selected.any');
});
