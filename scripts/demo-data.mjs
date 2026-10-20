import { createHash } from 'node:crypto';

export const fixture = 'quick-math-demo-v1';
export const email = 'demo-student@example.com';
export const video = { id: '19231868', url: 'https://vimeo.com/19231868', duration: 98 };
export const expiredProducts = new Set(['calculus-advanced', 'calculus-advanced-problems']);

const subjects = [
  { name: 'math1', ids: ['math1-concepts', 'math1-workbook'], titles: ['수학1 개념 완성', '수학1 개념 워크북'], prices: [119000, 18000], tags: [['#강의', '#수학1'], ['#교재', '#수학1']], chapters: [
    ['01. 지수와 로그', ['지수법칙과 거듭제곱근', '로그의 정의와 성질', '상용로그의 활용']],
    ['02. 삼각함수', ['일반각과 호도법', '삼각함수의 그래프', '사인법칙과 코사인법칙']],
    ['03. 수열', ['등차수열과 등비수열', '수열의 합과 시그마', '수학적 귀납법']],
  ] },
  { name: 'calculus', ids: ['calculus-advanced', 'calculus-advanced-problems'], titles: ['미적분 고난도 풀이', '미적분 고난도 문제집'], prices: [149000, 24000], tags: [['#강의', '#미적분'], ['#교재', '#미적분']], chapters: [
    ['01. 수열의 극한과 급수', ['수열의 극한 조건 해석', '급수의 수렴과 발산', '등비급수 활용 문제']],
    ['02. 미분법의 활용', ['합성함수와 역함수의 미분', '접선과 함수의 증감', '극값과 방정식의 실근']],
    ['03. 적분법의 활용', ['치환적분과 부분적분', '정적분과 넓이', '속도와 거리의 적분']],
  ] },
  { name: 'probability', ids: ['probability-statistics-core', 'probability-statistics-notes'], titles: ['확률과 통계 핵심정리', '확통 유형 정리 노트'], prices: [89000, 20000], tags: [['#강의', '#확통'], ['#교재', '#확통']], chapters: [
    ['01. 경우의 수', ['순열과 조합의 기본', '중복순열과 중복조합', '이항정리와 계수']],
    ['02. 확률', ['확률의 덧셈정리', '조건부확률과 독립', '확률의 곱셈정리']],
    ['03. 통계', ['이산확률변수와 기댓값', '이항분포와 정규분포', '표본평균과 모평균의 추정']],
  ] },
  { name: 'exponential-logarithmic', ids: ['exponential-logarithmic-core', 'exponential-logarithmic-workbook'], titles: ['지수함수와 로그함수 핵심 정리', '지수·로그 개념 완성 문제집'], prices: [99000, 20000], tags: [['#지수함수', '#로그함수'], ['#지수함수', '#로그함수']], chapters: [
    ['01. 지수함수와 로그함수', ['거듭제곱근의 성질', '거듭제곱근 기초 연산 및 개념 확인 문제', '지수의 확장과 지수법칙', '지수법칙을 활용한 식의 간단화 및 실전 문제']],
    ['02. 지수함수 심화', ['지수함수의 그래프와 평행이동', '지수방정식의 풀이', '지수부등식의 풀이']],
    ['03. 로그함수 심화', ['로그함수의 그래프와 성질', '로그방정식의 풀이', '로그부등식과 정의역']],
  ] },
];

export const products = subjects.flatMap(subject => subject.ids.map((id, index) => ({
  id, slug: id, kind: index ? 'pdf' : 'vod', title: subject.titles[index], price: subject.prices[index],
  base_price: subject.name === 'exponential-logarithmic' ? (index ? 25000 : 160000) : null,
  image: `/assets/${subject.name === 'exponential-logarithmic' ? 'detail-imgRectangle3' : 'listing-imgRectangle3'}.png`,
  tags: subject.tags[index], selling: true, license_days: 60, subject: subject.name,
})));
export const chapters = subjects.flatMap(subject => subject.chapters.map(([title], position) => ({
  id: subject.name === 'exponential-logarithmic' ? `chapter-${position + 1}` : `demo-${subject.name}-chapter-${position + 1}`,
  product_id: subject.ids[0], title, position, active: true,
})));
export const lessons = subjects.flatMap(subject => subject.chapters.flatMap(([, titles], chapterIndex) => titles.map((title, position) => ({
  id: subject.name === 'exponential-logarithmic' && chapterIndex === 0 ? `lesson-${position + 1}` : `demo-${subject.name}-lesson-${chapterIndex + 1}-${position + 1}`,
  chapter_id: chapters.find(chapter => chapter.product_id === subject.ids[0] && chapter.position === chapterIndex).id,
  product_id: subject.ids[0], title, position, duration_seconds: video.duration, preview: chapterIndex === 0 && position === 0,
  vimeo_id: video.id, vimeo_url: video.url, active: true,
}))));
export const originalDurations = { 'lesson-1': 1104, 'lesson-2': 1450, 'lesson-3': 1865, 'lesson-4': 1668 };

export function stableId(value) {
  const hex = createHash('sha256').update(`${fixture}:${value}`).digest('hex').slice(0, 32).split('');
  hex[12] = '5'; hex[16] = '8';
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
export function sameFields(actual, expected, keys = Object.keys(expected)) {
  return keys.every(key => JSON.stringify(actual[key]) === JSON.stringify(expected[key]));
}
export function assertDemoUser(user) {
  if (user && (user.email !== email || user.app_metadata?.demo_fixture !== fixture)) throw new Error('Demo email belongs to another account; no account was changed');
}
export function assertOriginalLesson(row, snapshots) {
  const expected = lessons.find(lesson => lesson.id === row.id);
  if (!expected || !sameFields(row, expected, ['id', 'chapter_id', 'product_id', 'title', 'position', 'preview', 'active'])) throw new Error(`Unexpected lesson: ${row.id}`);
  if (row.duration_seconds === video.duration && row.vimeo_id === video.id && row.vimeo_url === video.url) return false;
  if (row.duration_seconds !== originalDurations[row.id] || row.vimeo_id !== null || row.vimeo_url !== null) throw new Error(`Lesson is not an untouched Figma fixture: ${row.id}`);
  if (snapshots.some(snapshot => snapshot.lesson_id === row.id)) throw new Error(`Purchased lesson snapshot exists; refusing duration normalization: ${row.id}`);
  return true;
}
export function paymentDate(product, now = new Date()) {
  const daysAgo = expiredProducts.has(product.id) ? product.license_days + 10 : 3;
  return new Date(now.getTime() - daysAgo * 86400000).toISOString();
}
export const subjectNames = subjects.map(subject => subject.name);

const reviewTopics = {
  math1: ['지수·로그, 삼각함수, 수열의 단원 구성을 확인할 수 있었어요.', '기본 개념과 워크북을 함께 확인하는 데 도움이 되었어요.'],
  calculus: ['수열의 극한부터 미분과 적분까지 학습 순서를 살펴볼 수 있었어요.', '치환적분과 정적분 문제의 구성을 확인하기 편했어요.'],
  probability: ['경우의 수, 확률, 통계의 단원 구분이 잘 보였어요.', '조건부확률과 확률분포 문제를 함께 살펴볼 수 있었어요.'],
  'exponential-logarithmic': ['거듭제곱근과 지수법칙에서 함수의 그래프로 이어지는 구성을 확인했어요.', '지수방정식과 로그부등식의 학습 순서를 살펴볼 수 있었어요.'],
};
export const reviews = products.flatMap(product => Array.from({ length: product.kind === 'vod' ? 2 : 1 }, (_, index) => ({
  id: stableId(`review:${product.id}:${index}`), product_id: product.id, rating: 5,
  author: index ? '샘플 이*준' : '샘플 김*민',
  body: `${reviewTopics[product.subject][index]} ${product.kind === 'vod' ? '체험 화면 확인을 위한 샘플 후기이며, 영상은 공개 테스트 클립입니다.' : '체험용 PDF 문제와 해설을 확인하기 위한 샘플 후기입니다.'}`,
  created_at: index ? '2026-10-04T00:00:00Z' : '2026-10-06T00:00:00Z',
})));
export function assertDemoReview(row) {
  const expected = reviews.find(review => review.id === row.id);
  if (!expected || !sameFields(row, expected, ['id', 'product_id', 'author', 'body', 'rating']) || Date.parse(row.created_at) !== Date.parse(expected.created_at)) throw new Error(`Existing sample review differs: ${row.id}`);
}
