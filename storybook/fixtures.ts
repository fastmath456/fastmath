import type { Order, Orders, Profile, RefundQuote } from '@/features/account';
import type { ProductDetail, ProductList } from '@/features/catalog';
import type { Classroom, Viewer } from '@/features/classroom';
import type { SourceReview } from '@/features/landing';
import type { AdminCourse, AdminRefund, AdminRefundDetail, CourseAsset, CourseDraft } from '@/features/manage';

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

const refundRow = (item: Omit<AdminRefund, 'email' | 'external'> & Partial<Pick<AdminRefund, 'email' | 'external'>>): AdminRefund => ({ email: 'student@example.test', external: false, ...item });
export const adminCourses: AdminCourse[] = [
  { id: 'math-1', status: 'selling', kind: 'vod', title: '수학1 개념 완성', slug: 'math-1', image: '/assets/detail-imgRectangle3.png', price: 99000, licenseDays: 60, lessons: 12, date: '2026-11-12T03:00:00Z', step: 1 },
  { id: 'stat-1', status: 'selling', kind: 'vod', title: '확률과 통계 핵심정리', slug: 'stat-1', image: '/assets/detail-imgRectangle3.png', price: 89000, licenseDays: 30, lessons: 8, date: '2026-11-11T03:00:00Z', step: 1 },
  { id: 'note-1', status: 'selling', kind: 'pdf', title: '확통 유형 정리 노트', slug: 'note-1', image: '/assets/detail-imgRectangle3.png', price: 20000, licenseDays: 60, lessons: 0, date: '2026-11-10T03:00:00Z', step: 1 },
  { id: 'calc-1', status: 'stopped', kind: 'vod', title: '수학1 개념 완성부터 실전 문제 풀이까지 지수 로그 삼각함수 수열 종합 완성 과정', slug: 'calc-1', image: '/assets/detail-imgRectangle3.png', price: 119000, licenseDays: 60, lessons: 2, date: '2026-11-09T03:00:00Z', step: 1 },
  { id: '11111111-1111-4111-8111-111111111111', status: 'draft', kind: 'vod', title: '', slug: null, image: null, price: null, licenseDays: null, lessons: 0, date: '2026-11-13T03:00:00Z', step: 1 },
];

export const adminRefunds: AdminRefund[] = [
  refundRow({ orderId: '00000000-0000-4000-8000-000000000101', requestedAt: '2026-11-13T05:02:00Z', status: 'review', name: '홍길동', title: '수학1 개념 완성', kind: 'vod', paidAmount: 99000, refundAmount: 92070, usedSeconds: 2520, totalSeconds: 36000, downloaded: false }),
  refundRow({ orderId: '00000000-0000-4000-8000-000000000102', requestedAt: '2026-11-13T02:40:00Z', status: 'review', external: true, name: '김민지', email: 'minji@example.test', title: '미적분 고난도 풀이', kind: 'vod', paidAmount: 120000, refundAmount: 15000, usedSeconds: 7200, totalSeconds: 36000, downloaded: false }),
  refundRow({ orderId: '00000000-0000-4000-8000-000000000103', requestedAt: '2026-11-12T09:21:00Z', status: 'processing', name: '이서준', email: 'seojun@example.test', title: '확률과 통계 핵심정리', kind: 'vod', paidAmount: 89000, refundAmount: 89000, usedSeconds: 0, totalSeconds: 36000, downloaded: false }),
  refundRow({ orderId: '00000000-0000-4000-8000-000000000104', requestedAt: '2026-11-10T00:15:00Z', status: 'completed', name: '박지훈', email: 'jihoon@example.test', title: '확통 유형 정리 노트', kind: 'pdf', paidAmount: 20000, refundAmount: 20000, usedSeconds: 0, totalSeconds: 0, downloaded: false }),
  refundRow({ orderId: '00000000-0000-4000-8000-000000000105', requestedAt: '2026-11-09T11:47:00Z', status: 'rejected', name: '최유나', email: 'yuna@example.test', title: '수학1 개념 완성', kind: 'vod', paidAmount: 99000, refundAmount: 47850, usedSeconds: 18600, totalSeconds: 36000, downloaded: false }),
];
const refundDetail = (item: AdminRefund, extra: Partial<AdminRefundDetail> = {}): AdminRefundDetail => {
  const { downloaded, ...rest } = item;
  return {
    ...rest, reason: null, paidAt: '2026-11-12T03:00:00Z', progress: 0, downloads: downloaded ? 1 : 0,
    startsAt: '2026-11-12T03:00:00Z', expiresAt: '2027-01-11T03:00:00Z', cancelStartedAt: null,
    payment: { status: 'paid', cancelledAmount: 0, balance: item.paidAmount, partialCancel: true }, ...extra,
  };
};
export const adminRefundDetails = {
  review: refundDetail(adminRefunds[0], { progress: 7 }),
  external: refundDetail(adminRefunds[1], { progress: 20, reason: 'PG에서 확인한 외부 취소', payment: { status: 'partialCancelled', cancelledAmount: 15000, balance: 105000, partialCancel: true } }),
  processing: refundDetail(adminRefunds[2], { cancelStartedAt: '2026-11-12T09:21:07Z' }),
};
