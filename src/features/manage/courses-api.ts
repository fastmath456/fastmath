import { readResponse } from '@/lib/http';
import type { AdminCourse } from './courses-types';

export async function getCourses() {
  const data = await readResponse<{ items: AdminCourse[] }>(await fetch('/api/admin/courses', { credentials: 'same-origin' }));
  if (!Array.isArray(data.items)) throw new Error('Invalid courses response');
  return data.items;
}
