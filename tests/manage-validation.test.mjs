import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import ts from 'typescript';

const compiled = mkdtempSync(join(tmpdir(), 'quick-math-manage-validation-'));
const source = readFileSync('src/features/manage/validation.ts', 'utf8');
writeFileSync(
  join(compiled, 'validation.mjs'),
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText,
);
const validation = await import(pathToFileURL(join(compiled, 'validation.mjs')).href);

const asset = { id: 'asset', name: 'asset.webp', url: '/asset.webp', size: 1, type: 'image/webp' };
function validBasic(overrides = {}) {
  return {
    title: '빠른수학 기초',
    basePrice: '100,000',
    price: '90,000',
    licenseDays: '',
    displayOrder: '0',
    reviews: [],
    thumbnail: asset,
    detailImages: [asset],
    materials: [],
    ...overrides,
  };
}
function validChapters(overrides = {}) {
  return [{
    id: 'chapter-1',
    title: '  1장  ',
    lessons: [{
      id: 'lesson-1',
      title: '  1강  ',
      inputUrl: 'https://vimeo.com/123456789/privatehash',
      video: {
        url: 'https://vimeo.com/123456789/privatehash',
        embedUrl: 'https://player.vimeo.com/video/123456789?h=privatehash&autoplay=0',
        durationSeconds: 60,
      },
    }],
    ...overrides,
  }];
}

test('empty document starts with one unrated review and preserves a blank required order', () => {
  const document = validation.emptyDocument();
  assert.equal(document.basic.displayOrder, '');
  assert.deepEqual(document.basic.detailImages, []);
  assert.equal(document.basic.reviews.length, 1);
  assert.equal(document.basic.reviews[0].rating, null);
  assert.equal(validation.isEmptyReview(document.basic.reviews[0]), true);
  assert.notEqual(validation.emptyReview().id, document.basic.reviews[0].id);
  assert.equal(document.step, 1);
});

test('basic validation accepts blank period as the 60-day default and rejects incomplete values', () => {
  assert.deepEqual(validation.validateBasic(validBasic()), {});
  assert.deepEqual(validation.validateBasic(validBasic({ licenseDays: '60' })), {});
  const errors = validation.validateBasic(validBasic({
    title: '   ',
    basePrice: '100,000',
    price: '100,001',
    licenseDays: '1.5',
    thumbnail: null,
    detailImages: [],
  }));
  assert.equal(errors.title, '클래스명을 입력해주세요.');
  assert.equal(errors.price, '할인가는 원가 이하로 입력해주세요.');
  assert.equal(errors.licenseDays, '수강 가능 기간을 1일 이상의 정수로 입력해주세요.');
  assert.equal(errors.thumbnail, '클래스 대표이미지를 등록해주세요.');
  assert.equal(errors.detailImages, '클래스 상세이미지를 등록해주세요.');
});

test('prices require a positive database integer and retain comma-formatted display values', () => {
  assert.deepEqual(validation.validateBasic(validBasic({ basePrice: '2,147,483,647', price: '2,147,483,647' })), {});
  assert.equal(validation.validateBasic(validBasic({ basePrice: '2,147,483,648' })).basePrice, '원가를 1원 이상의 정수로 입력해주세요.');
  assert.equal(validation.validateBasic(validBasic({ price: '1,00' })).price, '할인가를 1원 이상의 정수로 입력해주세요.');
  assert.equal(validation.validateBasic(validBasic({ price: '1.0' })).price, '할인가를 1원 이상의 정수로 입력해주세요.');
  assert.equal(validation.validateBasic(validBasic({ licenseDays: '2147483648' })).licenseDays, '수강 가능 기간을 1일 이상의 정수로 입력해주세요.');
  assert.equal(validation.formattedPrice('1000000'), '1,000,000');
  assert.equal(validation.formattedPrice('1,000,000'), '1,000,000');
  assert.equal(validation.formattedPrice('012'), '012');
  assert.equal(validation.formattedPrice('2147483648'), '2147483648');
  assert.equal(validation.formattedPrice('1.5'), '1.5');
});

test('curriculum cannot publish incomplete names, lessons, videos, or pending URLs', () => {
  assert.equal(validation.validateCurriculum([]), '챕터를 추가해주세요.');
  assert.match(validation.validateCurriculum(validChapters({ title: ' '.repeat(101) })), /챕터명/);
  assert.equal(validation.validateCurriculum(validChapters({ lessons: [] })), '차시를 추가해주세요.');
  assert.match(validation.validateCurriculum(validChapters({ lessons: [{ ...validChapters()[0].lessons[0], title: ' '.repeat(101) }] })), /차시명/);
  assert.match(validation.validateCurriculum(validChapters({ lessons: [{ ...validChapters()[0].lessons[0], video: null }] })), /영상/);
  assert.equal(validation.validateCurriculum(validChapters({ lessons: [{ ...validChapters()[0].lessons[0], inputUrl: 'https://vimeo.com/changed' }] })), '변경한 영상 링크가 아직 반영되지 않았습니다.');
  assert.equal(validation.validateCurriculum(validChapters()), null);
});

test('Vimeo URLs reject SSRF-shaped hosts and preserve private-video access data', () => {
  for (const value of [
    'https://vimeo.com',
    'http://vimeo.com/123456789',
    'https://vimeo.com:444/123456789',
    'https://user@vimeo.com/123456789',
    'https://vimeo.com@127.0.0.1/123456789',
    'https://vimeo.com.evil.example/123456789',
    'https://127.0.0.1/123456789',
    'https://player.vimeo.com/video/not-an-id',
  ]) assert.equal(validation.parseVimeoUrl(value), null, value);

  assert.deepEqual(validation.parseVimeoUrl('  https://vimeo.com/123456789/unlisted-key?quality=1080p  '), {
    id: '123456789',
    hash: 'unlisted-key',
    url: 'https://vimeo.com/123456789/unlisted-key?quality=1080p',
    embedUrl: 'https://player.vimeo.com/video/123456789?h=unlisted-key&autoplay=0',
  });
  assert.deepEqual(validation.parseVimeoUrl('https://player.vimeo.com/video/123456789?h=player-key'), {
    id: '123456789',
    hash: 'player-key',
    url: 'https://player.vimeo.com/video/123456789?h=player-key',
    embedUrl: 'https://player.vimeo.com/video/123456789?h=player-key&autoplay=0',
  });
});

test('Vimeo URLs use the same 2,048-character limit as the video verification API', () => {
  const prefix = 'https://vimeo.com/123456789?label=';
  const atLimit = prefix + 'a'.repeat(2_048 - prefix.length);

  assert.notEqual(validation.parseVimeoUrl(atLimit), null);
  assert.equal(validation.parseVimeoUrl(atLimit + 'a'), null);
});

test.after(() => rmSync(compiled, { recursive: true, force: true }));

test('order accepts zero and leading zeros, rejects missing, negative, fractional and exponential input', () => {
  for (const displayOrder of ['0', ' 001 ', '2147483647']) assert.equal(validation.validateBasic(validBasic({ displayOrder })).displayOrder, undefined);
  for (const displayOrder of ['', ' ', '-1', '1.2', '1e3', '2147483648']) assert.ok(validation.validateBasic(validBasic({ displayOrder })).displayOrder);
});

test('blank reviews are optional while partially entered reviews require every field', () => {
  const review = validation.emptyReview();
  assert.deepEqual(validation.validateReview(review), {});
  const partial = { ...review, body: '내용' };
  assert.deepEqual(Object.keys(validation.validateReview(partial)).sort(), ['author', 'rating']);
  assert.ok(validation.validateBasic(validBasic({ reviews: [partial] })).reviews[review.id]);
  for (const rating of [0, 1.5, 6]) assert.ok(validation.validateReview({ ...partial, rating, author: '김학생' }).rating);
  const complete = { ...partial, rating: 3, author: ' 김학생 ', body: '첫째 줄\n둘째 줄 😊' };
  assert.deepEqual(validation.validateReview(complete), {});
  assert.ok(validation.validateReview({ ...complete, author: '김'.repeat(51) }).author);
  assert.equal(validation.validateReview({ ...complete, body: '😊'.repeat(5000) }).body, undefined);
  assert.ok(validation.validateReview({ ...complete, body: '😊'.repeat(5001) }).body);
});
