import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { http, HttpResponse } from 'msw';
import ViewerPage from '@/app/classroom/courses/[courseId]/page';
import ClassroomPage from '@/app/classroom/page';
import { course } from '../fixtures';
import { navigation } from '../navigation';

const meta = { title: 'Pages/Classroom' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Classroom: Story = {
  name: '내 강의실', tags: ['route:/classroom'], parameters: navigation('/classroom'),
  render: () => <ClassroomPage searchParams={Promise.resolve({})} />,
};

export const Empty: Story = {
  ...Classroom, name: '내 강의실 · 구매 내역 없음',
  parameters: { ...Classroom.parameters, msw: { handlers: { classroom: http.get('/api/classroom', () => HttpResponse.json({ items: [], count: 0 })) } } },
};

export const Viewer: Story = {
  name: '강의 재생 화면', tags: ['route:/classroom/courses/[courseId]'],
  parameters: navigation(`/classroom/courses/${course.id}`),
  render: () => <ViewerPage params={Promise.resolve({ courseId: course.id })} searchParams={Promise.resolve({})} />,
};

export const Preview: Story = {
  ...Viewer, name: '강의 미리보기',
  render: () => <ViewerPage params={Promise.resolve({ courseId: course.id })} searchParams={Promise.resolve({ preview: '1', lesson: 'lesson-1' })} />,
};
