import { readResponse } from '@/lib/http';
import type { Classroom, Viewer } from './types';

export async function getClassroom(): Promise<Classroom> {
  const response = await fetch('/api/classroom');
  const data = await readResponse<Classroom>(response);
  if (!Array.isArray(data.items) || !Number.isInteger(data.count)) throw new Error('Invalid classroom response');
  return data;
}
export async function downloadMaterials(orderId: string) {
  const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/download`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  if (response.ok && response.headers.get('content-type') === 'application/zip') {
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    const filename = response.headers.get('content-disposition')?.match(/filename\*=UTF-8''([^;]+)/)?.[1];
    link.href = url; link.download = filename ? decodeURIComponent(filename) : 'materials.zip';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    const data = await readResponse<{ url: string }>(response);
    location.assign(data.url);
  }
}
export async function getViewer(courseId: string, preview = false, lessonId?: string): Promise<Viewer> {
  const suffix = preview ? `/preview${lessonId ? `?lesson=${encodeURIComponent(lessonId)}` : ''}` : '';
  const response = await fetch(`/api/classroom/courses/${encodeURIComponent(courseId)}${suffix}`);
  const data = await readResponse<Viewer>(response);
  if (!Array.isArray(data.chapters) || typeof data.title !== 'string') throw new Error('Invalid viewer response');
  return data;
}
