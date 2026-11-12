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
