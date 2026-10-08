import type { Chapter, Product, ProductDetail, ProductSort, Review } from '@/features/catalog';

const productRows = [
  ['math1-concepts', 'vod', '수학1 개념 완성', '수학1', 119000],
  ['math1-workbook', 'pdf', '수학1 개념 워크북', '수학1', 18000],
  ['calculus-advanced', 'vod', '미적분 고난도 풀이', '미적분', 149000],
  ['calculus-advanced-problems', 'pdf', '미적분 고난도 문제집', '미적분', 24000],
  ['probability-statistics-core', 'vod', '확률과 통계 핵심정리', '확통', 89000],
  ['probability-statistics-notes', 'pdf', '확통 유형 정리 노트', '확통', 20000],
] as const;
export const products: Product[] = productRows.map(([slug, kind, title, subject, price], publishedOrder) => ({ id: slug, slug, kind, title, price, tags: [kind === 'vod' ? '#강의' : '#교재', `#${subject}`], image: '/assets/listing-imgRectangle3.png', publishedOrder }));
export const detailReviews: Review[] = [
  {
    "body": "지수함수와 로그함수의 정의와 그래프를 명확하게 정리해 주셔서 이해가 훨씬 쉬웠어요. 특히 거듭제곱근과 지수법칙의 예시가 많아서 실제 문제 풀이에 바로 적용할 수 있었습니다.",
    "author": "김*민",
    "date": "2026.10.06",
    "rating": 5
  },
  {
    "body": "로그함수의 역함수 관계를 처음 배웠는데, 설명이 너무 체계적이었어요. 특히 지수함수와 로그함수를 연결해 주는 예시가 많아서 앞뒤 맥락이 바로 보였습니다.",
    "author": "이*준",
    "date": "2026.10.04",
    "rating": 5
  },
  {
    "body": "실전 문제 풀이가 많아서 실제 시험 문제에 바로 적용할 수 있었어요. 특히 지수함수와 로그함수를 연결하는 방법을 정리해 주셔서 기출 유형도 더 쉽게 읽혔습니다.",
    "author": "박*서",
    "date": "2026.10.02",
    "rating": 5
  }
];
export const detailChapters: Chapter[] = [
  { id: 'chapter-1', title: '01. 지수함수와 로그함수', lessons: [
    { id: 'lesson-1', title: '거듭제곱근의 성질', duration: '00:18:24', preview: true },
    { id: 'lesson-2', title: '거듭제곱근 기초 연산 및 개념 확인 문제', duration: '00:24:10' },
    { id: 'lesson-3', title: '지수의 확장과 지수법칙', duration: '00:31:05' },
    { id: 'lesson-4', title: '지수법칙을 활용한 식의 간단화 및 실전 문제', duration: '00:27:48' },
  ] },
  { id: 'chapter-2', title: '02. 지수함수 심화', lessons: [] },
  { id: 'chapter-3', title: '03. 로그함수 심화', lessons: [] },
];
export const exampleDetails: Product[] = [
  { id: 'exponential-logarithmic-core', slug: 'exponential-logarithmic-core', kind: 'vod', title: '지수함수와 로그함수 핵심 정리', tags: ['#지수함수', '#로그함수'], price: 99000, basePrice: 160000, image: '/assets/detail-imgRectangle3.png', publishedOrder: 0 },
  { id: 'exponential-logarithmic-workbook', slug: 'exponential-logarithmic-workbook', kind: 'pdf', title: '지수·로그 개념 완성 문제집', tags: ['#지수함수', '#로그함수'], price: 20000, basePrice: 25000, image: '/assets/detail-imgRectangle3.png', publishedOrder: 0 },
];
export function sortProducts(items: Product[], sort: ProductSort) {
  return [...items].sort((a, b) => (sort === 'latest' ? 0 : sort === 'price-asc' ? a.price - b.price : b.price - a.price) || a.publishedOrder - b.publishedOrder || a.id.localeCompare(b.id));
}
export function productDetail(product: Product, state: string, view: string): ProductDetail {
  return { ...product, reviews: state === 'empty-reviews' ? [] : product.kind === 'vod' && product.slug === exampleDetails[0].slug ? detailReviews : [],
    chapters: product.kind === 'vod' && product.slug === exampleDetails[0].slug ? detailChapters : [], ownership: state === 'owned' ? 'owned' : 'none', selling: state !== 'ended', admin: view === 'admin' && product.kind === 'vod',
    profile: view === 'admin' ? { name: '김민준', image: '/assets/admin-imgRectangle2.png' } : undefined };
}
