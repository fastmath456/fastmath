import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { http, HttpResponse } from 'msw';
import BookPage from '@/app/books/[slug]/page';
import CoursePage from '@/app/courses/[slug]/page';
import CatalogPage from '@/app/courses/page';
import { book, course } from '../fixtures';
import { navigation } from '../navigation';

const meta = { title: 'Pages/Catalog' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Catalog: Story = {
  name: '강의·교재 목록', tags: ['route:/courses'], parameters: navigation('/courses'),
  render: () => <CatalogPage searchParams={Promise.resolve({})} />,
};

export const Course: Story = {
  name: '강의 상세', tags: ['route:/courses/[slug]'], parameters: navigation(`/courses/${course.slug}`),
  render: () => <CoursePage params={Promise.resolve({ slug: course.slug })} searchParams={Promise.resolve({})} />,
};

export const AdminCourse: Story = {
  ...Course, name: '강의 상세 · 관리자 안내',
  globals: { viewport: { value: 'desktop', isRotated: false } },
  parameters: {
    ...Course.parameters,
    msw: { handlers: { product: http.get(`/api/products/${course.slug}`, () => HttpResponse.json({ ...course, admin: true })) } },
  },
};

export const LongTitleReviews: Story = {
  ...Course, name: '강의 상세 · 긴 제목과 후기 5개',
  parameters: {
    ...Course.parameters,
    msw: { handlers: { product: http.get(`/api/products/${course.slug}`, () => HttpResponse.json({
      ...course,
      title: '수학1 개념 완성'.repeat(10),
      reviews: [
        { id: 'test-review-1', rating: 4.5, body: '[테스트 리뷰] 지수랑 로그를 공식으로만 외웠는데, 그래프와 같이 놓고 보니까 차이가 기억에 남아요.', author: '테스트 리뷰 1', date: '2026.11.10' },
        { id: 'test-review-2', rating: 5, body: '[테스트 리뷰] 삼각함수 그래프에서 주기랑 평행이동을 자꾸 섞었는데 그 부분을 다시 봤어요.', author: '테스트 리뷰 2', date: '2026.11.10' },
        { id: 'test-review-3', rating: 4, body: '[테스트 리뷰] 수열 문제를 풀 때 첫 항이랑 공차를 먼저 써 두니까 중간에 덜 헷갈렸습니다.', author: '테스트 리뷰 3', date: '2026.11.10' },
        { id: 'test-review-4', rating: 4.5, body: '[테스트 리뷰] 아는 개념이라고 넘겼던 부분을 기본 예제로 다시 확인하기 좋았어요.', author: '테스트 리뷰 4', date: '2026.11.10' },
        { id: 'test-review-5', rating: 5, body: '[테스트 리뷰] 공식만 적어 두기보다 어떤 문제에서 쓰는지 옆에 같이 적게 됐어요.', author: '테스트 리뷰 5', date: '2026.11.10' },
      ],
    })) } },
  },
};

export const Book: Story = {
  name: '교재 상세', tags: ['route:/books/[slug]'], parameters: navigation(`/books/${book.slug}`),
  render: () => <BookPage params={Promise.resolve({ slug: book.slug })} searchParams={Promise.resolve({})} />,
};

export const MissingDetailImage: Story = {
  ...Book, name: '교재 상세 · 소개 이미지 없음',
  parameters: {
    ...Book.parameters,
    msw: { handlers: { product: http.get(`/api/products/${book.slug}`, () => HttpResponse.json({ ...book, detailImage: null })) } },
  },
};
