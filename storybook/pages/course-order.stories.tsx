import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fireEvent, userEvent, waitFor } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { CourseOrderDialog } from '@/features/manage/course-order-dialog';
import type { CourseProductOrder } from '@/features/manage/types';
import { course, draft } from '../fixtures';

const items = Array.from({ length: 6 }, (_, index) => ({ ...course, id: index === 0 ? course.id : `course-${index}`, title: `강의 ${index + 1}` }));
const meta = {
  title: 'Pages/CourseOrder',
  parameters: { msw: { handlers: { catalog: http.get('/api/products', () => HttpResponse.json({ items, count: items.length })) } } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function Example({ editing = false }: { editing?: boolean }) {
  const [open, setOpen] = useState(true);
  const [value, setValue] = useState<CourseProductOrder>();
  return <div style={{ padding: 24 }}>
    <button type="button" onClick={() => setOpen(true)}>정렬 순서</button>
    <output aria-label="선택한 순서">{value ? JSON.stringify(value.ids) : '저장 전'}</output>
    {open && <CourseOrderDialog basic={{ ...draft.document.basic, title: editing ? course.title : '신규 강의' }} courseId={editing ? course.id : undefined} value={value} onCancel={() => setOpen(false)} onSave={next => { setValue(next); setOpen(false); }} />}
  </div>;
}
export const NewCourse: Story = { name: '등록 중 신규 강의 정렬', render: () => <Example /> };
export const EditCourse: Story = { name: '기존 강의 정렬', render: () => <Example editing /> };

export const TouchReorder: Story = {
  ...EditCourse, name: '터치로 순서 변경',
  play: async ({ canvas }) => {
    const source = await canvas.findByRole('button', { name: `${course.title}, 1번째. 방향키로 순서 변경` });
    const target = canvas.getByRole('button', { name: '강의 2, 2번째. 방향키로 순서 변경' });
    source.scrollIntoView({ block: 'nearest' });
    const start = source.getBoundingClientRect(), end = target.getBoundingClientRect();
    const touch = new Touch({ identifier: 1, target: source, clientX: start.x + start.width / 2, clientY: start.y + 10 });
    const dropped = new Touch({ identifier: 1, target: source, clientX: end.x + end.width / 2, clientY: end.y + 10 });
    await fireEvent.touchStart(source, { touches: [touch], changedTouches: [touch] });
    await new Promise(resolve => setTimeout(resolve, 350));
    await fireEvent.touchMove(source, { touches: [dropped], changedTouches: [dropped] });
    await fireEvent.touchEnd(source, { touches: [], changedTouches: [dropped] });
    await waitFor(() => expect(canvas.getByRole('button', { name: `${course.title}, 2번째. 방향키로 순서 변경` })).toBeVisible());
    await userEvent.click(canvas.getByRole('button', { name: '저장' }));
    await expect(canvas.getByLabelText('선택한 순서')).toHaveTextContent(JSON.stringify(['course-1', null, 'course-2', 'course-3', 'course-4', 'course-5']));
    await userEvent.click(canvas.getByRole('button', { name: '정렬 순서' }));
    const reordered = await canvas.findByRole('button', { name: `${course.title}, 2번째. 방향키로 순서 변경` });
    await expect(reordered).toBeVisible();
    await userEvent.click(reordered);
    await userEvent.keyboard('{ArrowLeft}');
    const first = canvas.getByRole('button', { name: `${course.title}, 1번째. 방향키로 순서 변경` });
    const second = canvas.getByRole('button', { name: '강의 2, 2번째. 방향키로 순서 변경' });
    const dataTransfer = new DataTransfer();
    await fireEvent.dragStart(first, { dataTransfer });
    await fireEvent.dragOver(second, { dataTransfer });
    await fireEvent.drop(second, { dataTransfer });
    await fireEvent.dragEnd(first, { dataTransfer });
    await expect(canvas.getByRole('button', { name: `${course.title}, 2번째. 방향키로 순서 변경` })).toBeVisible();
  },
};
