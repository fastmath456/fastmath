import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import EditCoursePage from '@/app/manage/courses/[courseId]/edit/page';
import NewCoursePage from '@/app/manage/courses/new/page';
import { course, draft } from '../fixtures';
import { navigation } from '../navigation';

const meta = { title: 'Pages/Manage' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const NewCourse: Story = {
  name: '클래스 등록', tags: ['route:/manage/courses/new'], parameters: navigation('/manage/courses/new'),
  render: () => <NewCoursePage searchParams={Promise.resolve({})} />,
};

export const EditCourse: Story = {
  name: '클래스 수정', tags: ['route:/manage/courses/[courseId]/edit'],
  parameters: navigation(`/manage/courses/${course.id}/edit`),
  render: () => <EditCoursePage params={Promise.resolve({ courseId: course.id })} searchParams={Promise.resolve({})} />,
};

export const Curriculum: Story = {
  ...NewCourse, name: '클래스 등록 · 커리큘럼',
  render: () => <NewCoursePage searchParams={Promise.resolve({ draft: draft.id, step: '2' })} />,
};
