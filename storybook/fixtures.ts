import type { Order, Orders, Profile, RefundQuote } from '@/features/account';
import type { ProductDetail, ProductList } from '@/features/catalog';
import type { Classroom, Viewer } from '@/features/classroom';
import type { SourceReview } from '@/features/landing';
import type { CourseAsset, CourseDraft } from '@/features/manage';

export const profile: Profile = {
  name: '홍길동', email: 'student@example.test', birthday: '20050101', phone: '01012345678',
  image: '', avatar: '/assets/default-profile.png', marketing: false, revision: 'storybook',
};

const thumbnail: CourseAsset = {
  id: 'sample-thumbnail', name: '대표이미지.png', url: '/assets/detail-imgRectangle3.png', size: 123456, type: 'image/png',
};
const detailImage = { ...thumbnail, id: 'sample-detail', name: '상세이미지.png', width: 640, height: 410 };

export const course: ProductDetail = {
  id: 'math1-concepts', slug: 'math1-concepts', kind: 'vod', title: '수학1 개념 완성',
  tags: ['수학1', 'VOD'], price: 89000, basePrice: 99000, image: thumbnail.url, publishedOrder: 1,
  chapters: [{ id: 'chapter-1', title: '지수와 로그', lessons: [
    { id: 'lesson-1', title: '지수의 확장', duration: '00:18:00', preview: true },
    { id: 'lesson-2', title: '로그의 정의와 성질', duration: '00:23:00' },
  ] }],
  reviews: [{ body: '개념을 차근차근 설명해 주셔서 이해하기 쉬웠어요.', author: '홍*동', date: '2026.10.01', rating: 4.5 }],
  ownership: 'none', selling: true, admin: false, licenseDays: 60, detailImage,
};

export const book: ProductDetail = {
  ...course, id: 'math1-workbook', slug: 'math1-workbook', kind: 'pdf', title: '수학1 개념 워크북',
  tags: ['교재', '수학1'], price: 18000, basePrice: 20000, publishedOrder: 2, chapters: [], reviews: [],
};

export const catalog: ProductList = { items: [course, book], count: 2 };

export const courseOrder: Order = {
  id: 'course-order', title: course.title, kind: 'vod', status: '결제완료', amount: course.price,
  endDate: '2026.11.30', progress: '25%', paidDate: '2026.10.01', refundLabel: '환불 신청', refundable: true,
};
export const bookOrder: Order = {
  ...courseOrder, id: 'book-order', title: book.title, kind: 'pdf', amount: book.price, progress: '-',
};

export const orders: Orders = { items: [courseOrder, bookOrder], count: 2 };
export const refundQuote: RefundQuote = {
  orderId: courseOrder.id, title: course.title, text: '결제 금액: 89,000원\n환불 예정 금액: 66,750원',
  token: 'storybook', quote: {},
};
export const classroom: Classroom = {
  count: 2, items: [
    { id: courseOrder.id, orderId: courseOrder.id, courseId: course.id, kind: 'vod', title: course.title,
      image: course.image, status: '수강 중', period: '2026.10.01 ~ 2026.11.30', progress: 25, recent: '지수의 확장', expired: false },
    { id: bookOrder.id, orderId: bookOrder.id, kind: 'pdf', title: book.title,
      image: book.image, status: '다운로드 가능', period: '2026.10.01 ~ 2026.11.30', downloaded: '-', expired: false },
  ],
};

export const viewer: Viewer = {
  orderId: courseOrder.id, courseId: course.id, title: course.title, recentLessonId: 'lesson-1',
  poster: '/assets/classroom-img2.png', chapters: course.chapters,
};

export const draft: CourseDraft = {
  id: 'course-draft', courseId: course.id, slug: course.slug, revision: 1, published: false, savedAt: '2026-10-01T01:00:00Z',
  document: {
    basic: { title: course.title, basePrice: '99000', price: '89000', licenseDays: '60', displayOrder: '0', reviews: [{ id: 'sample-review', rating: 3, body: '개념 설명이 이해하기 쉬웠어요.\n다음 강의도 기대합니다.', author: '홍길동' }], thumbnail, detailImages: [detailImage, { ...detailImage, id: 'sample-detail-2', name: '상세이미지-2.png' }], materials: [] },
    chapters: course.chapters.map(chapter => ({ ...chapter, lessons: chapter.lessons.map(lesson => ({
      id: lesson.id, title: lesson.title, inputUrl: '', video: null,
    })) })),
    step: 1, selectedLessonId: 'lesson-1',
  },
};

export const review: SourceReview = {
  id: 'sample-review', author: '@수학공부', text: '개념을 이해하는 데 도움이 됐어요.',
  images: [{ src: '/assets/landing/review-480-3089.png', width: 354, height: 140 }],
};
