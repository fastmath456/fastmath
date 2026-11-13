import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
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
