import type { BasicErrors, CourseBasic, CourseChapter, CourseDocument, CourseReview, ReviewErrors } from './types';

const MAX_DATABASE_INTEGER = 2_147_483_647;
const MAX_VIMEO_URL_LENGTH = 2_048;
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);

function validName(value: string, maximum: number) {
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= maximum;
}

function positiveInteger(value: string, maximum = MAX_DATABASE_INTEGER) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maximum ? parsed : null;
}

function formattedPositiveInteger(value: string) {
  if (!/^(?:[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)$/.test(value)) return null;
  return positiveInteger(value.replaceAll(',', ''), MAX_DATABASE_INTEGER);
}

export function emptyReview(): CourseReview { return { id: crypto.randomUUID(), rating: null, body: '', author: '' }; }

export function isEmptyReview(review: CourseReview) { return review.rating === null && !review.body.trim() && !review.author.trim(); }

export function validateReview(review: CourseReview): ReviewErrors {
  const errors: ReviewErrors = {};
  if (isEmptyReview(review)) return errors;
  if (!Number.isInteger(review.rating) || review.rating! < 1 || review.rating! > 5) errors.rating = '학생이 남긴 별점을 1–5점 중 선택해주세요.';
  if (!review.body.trim()) errors.body = '후기 내용을 입력해주세요.';
  else if (Array.from(review.body).length > 5000) errors.body = '후기는 5,000자 이내로 입력해주세요.';
  if (!review.author.trim()) errors.author = '학생 이름을 입력해주세요.';
  else if (Array.from(review.author.trim()).length > 50) errors.author = '학생 이름은 50자 이내로 입력해주세요.';
  return errors;
}

export function emptyDocument(): CourseDocument {
  return {
    basic: {
      title: '',
      basePrice: '',
      price: '',
      licenseDays: '',
      displayOrder: '',
      reviews: [emptyReview()],
      thumbnail: null,
      detailImages: [],
      materials: [],
    },
    chapters: [],
    step: 1,
    selectedLessonId: null,
  };
}

export function validateBasic(basic: CourseBasic): BasicErrors {
  const errors: BasicErrors = {};
  const basePrice = formattedPositiveInteger(basic.basePrice);
  const price = formattedPositiveInteger(basic.price);

  if (!basic.thumbnail) errors.thumbnail = '클래스 대표이미지를 등록해주세요.';
  if (!basic.detailImages.length) errors.detailImages = '클래스 상세이미지를 등록해주세요.';
  if (!validName(basic.title, 100)) {
    errors.title = basic.title.trim() ? '클래스명은 100자 이내로 입력해주세요.' : '클래스명을 입력해주세요.';
  }
  if (basePrice === null) errors.basePrice = '원가를 1원 이상의 정수로 입력해주세요.';
  if (price === null) errors.price = '할인가를 1원 이상의 정수로 입력해주세요.';
  else if (basePrice !== null && price > basePrice) errors.price = '할인가는 원가 이하로 입력해주세요.';
  if (basic.licenseDays !== '' && positiveInteger(basic.licenseDays) === null) {
    errors.licenseDays = '수강 가능 기간을 1일 이상의 정수로 입력해주세요.';
  }

  const order = basic.displayOrder.trim();
  if (!order) errors.displayOrder = '정렬 순서를 입력해주세요.';
  else if (!/^\d+$/.test(order) || !Number.isSafeInteger(Number(order)) || Number(order) > MAX_DATABASE_INTEGER) errors.displayOrder = '정렬 순서는 0 이상의 정수로 입력해주세요.';
  const reviews = Object.fromEntries(basic.reviews.map(review => [review.id, validateReview(review)]).filter(([, error]) => Object.keys(error).length));
  if (Object.keys(reviews).length) errors.reviews = reviews;
  return errors;
}

export function validateCurriculum(chapters: CourseChapter[]): string | null {
  if (chapters.length === 0) return '챕터를 추가해주세요.';

  for (const chapter of chapters) {
    if (!validName(chapter.title, 100)) return '챕터명을 1자 이상 100자 이하로 입력해주세요.';
    if (chapter.lessons.length === 0) return '차시를 추가해주세요.';

    for (const lesson of chapter.lessons) {
      if (!validName(lesson.title, 100)) return '차시명을 1자 이상 100자 이하로 입력해주세요.';
      if (lesson.videoError) return lesson.videoError;
      if (!lesson.video || !Number.isFinite(lesson.video.durationSeconds) || lesson.video.durationSeconds <= 0) {
        return '차시에 연결된 영상을 확인해주세요.';
      }
      if (lesson.inputUrl.trim() !== lesson.video.url) return '변경한 영상 링크가 아직 반영되지 않았습니다.';
    }
  }

  return null;
}

export function parseVimeoUrl(value: string): { id: string; hash: string | null; url: string; embedUrl: string } | null {
  const input = value.trim();
  if (!input || input.length > MAX_VIMEO_URL_LENGTH) return null;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' || !VIMEO_HOSTS.has(url.hostname) || url.username || url.password || url.port) return null;

  const parts = url.pathname.split('/').filter(Boolean);
  let id: string | null = null;
  let pathHash: string | null = null;

  if (url.hostname === 'player.vimeo.com') {
    if (parts.length !== 2 || parts[0] !== 'video' || !/^\d+$/.test(parts[1])) return null;
    id = parts[1];
  } else {
    if ((parts.length !== 1 && parts.length !== 2) || !/^\d+$/.test(parts[0])) return null;
    id = parts[0];
    pathHash = parts[1] ?? null;
  }

  const queryHash = url.searchParams.get('h');
  const hash = queryHash || pathHash;
  const embed = new URL(`https://player.vimeo.com/video/${id}`);
  if (hash) embed.searchParams.set('h', hash);
  embed.searchParams.set('autoplay', '0');

  return { id, hash, url: url.toString(), embedUrl: embed.toString() };
}

export function formattedPrice(value: string): string {
  const amount = formattedPositiveInteger(value);
  if (amount === null) return value;
  return amount.toLocaleString('en-US');
}
