import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { http, HttpResponse } from 'msw';
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

export const ImageUploads: Story = {
  ...EditCourse, name: '클래스 수정 · 이미지 가로 스크롤',
  parameters: {
    ...EditCourse.parameters,
    msw: { handlers: { editCourse: http.get(`/api/admin/courses/${course.id}`, () => HttpResponse.json({ draft: {
      ...draft, id: '', document: { ...draft.document, basic: { ...draft.document.basic,
        detailImages: Array.from({ length: 6 }, (_, index) => ({ ...draft.document.basic.detailImages[0], id: `detail-${index}`, name: index === 0 ? 'math1.png' : index === 1 ? '수학1_개념완성_상세이미지_아주긴파일이름.png' : `상세이미지-${index + 1}.png` })),
      } },
    } })), upload: http.post('/api/admin/courses/uploads', async ({ request }) => {
      const file = (await request.formData()).get('file') as File;
      return HttpResponse.json({ asset: { ...draft.document.basic.thumbnail, id: crypto.randomUUID(), name: file.name } });
    }) } },
  },
};
