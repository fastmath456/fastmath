import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor } from 'storybook/test';
import { delay, http, HttpResponse } from 'msw';
import EditCoursePage from '@/app/manage/courses/[courseId]/edit/page';
import NewCoursePage from '@/app/manage/courses/new/page';
import CoursesPage from '@/app/manage/courses/page';
import RefundsPage from '@/app/manage/refunds/page';
import RefundPage from '@/app/manage/refunds/[orderId]/page';
import { adminRefundDetails, course, draft } from '../fixtures';
import { navigation } from '../navigation';

const meta = { title: 'Pages/Manage' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Courses: Story = {
  name: '강의 목록', tags: ['route:/manage/courses'], parameters: navigation('/manage/courses'),
  render: () => <CoursesPage />,
};

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

export const DetailImageUploading: Story = {
  ...ImageUploads, name: '상세이미지 업로드 중 문구 숨김',
  parameters: {
    ...ImageUploads.parameters,
    msw: { handlers: { ...ImageUploads.parameters?.msw.handlers, upload: http.post('/api/admin/courses/uploads', async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }) } },
  },
  play: async ({ canvas }) => {
    const input = await canvas.findByLabelText(/클래스 상세이미지/, { selector: 'input' });
    const blob = await (await fetch('/assets/detail-imgRectangle3.png')).blob();
    await userEvent.upload(input, new File([blob], '업로드-확인.png', { type: 'image/png' }));
    await waitFor(() => expect(canvas.getByRole('button', { name: '업로드-확인.png 삭제' })).toBeVisible());
    await expect(canvas.queryByText('업로드 중...', { exact: true })).not.toBeInTheDocument();
    await expect(canvas.queryByText('업로드 중', { exact: true })).not.toBeInTheDocument();
  },
};

export const Refunds: Story = {
  name: '환불 관리', tags: ['route:/manage/refunds'], parameters: navigation('/manage/refunds'),
  render: () => <RefundsPage />,
};

export const RefundReview: Story = {
  name: '환불 처리 · 확인 필요', tags: ['route:/manage/refunds/[orderId]'],
  parameters: navigation(`/manage/refunds/${adminRefundDetails.review.orderId}`),
  render: () => <RefundPage params={Promise.resolve({ orderId: adminRefundDetails.review.orderId })} />,
};

export const RefundExternal: Story = {
  ...RefundReview, name: '환불 처리 · PG 직접 취소',
  parameters: navigation(`/manage/refunds/${adminRefundDetails.external.orderId}`),
  render: () => <RefundPage params={Promise.resolve({ orderId: adminRefundDetails.external.orderId })} />,
};

export const RefundStuck: Story = {
  ...RefundReview, name: '환불 처리 · 응답 확인 필요',
  parameters: navigation(`/manage/refunds/${adminRefundDetails.processing.orderId}`),
  render: () => <RefundPage params={Promise.resolve({ orderId: adminRefundDetails.processing.orderId })} />,
};
