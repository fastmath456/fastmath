import { dataPath, readResponse } from '@/lib/http';
import type { Classroom, Viewer } from './types';

export async function getClassroom(state: string): Promise<Classroom> {
  const response = await fetch(dataPath(`/__mock/classroom?state=${encodeURIComponent(state)}`,'/api/classroom'));
  const data = await readResponse<Classroom>(response);
  if (!Array.isArray(data.items) || !Number.isInteger(data.count)) throw new Error('Invalid classroom response');
  return data;
}
export async function getViewer(courseId: string, state: string): Promise<Viewer> {
  const response = await fetch(dataPath(`/__mock/courses/${encodeURIComponent(courseId)}?state=${encodeURIComponent(state)}`,`/api/classroom/courses/${encodeURIComponent(courseId)}`));
  const data = await readResponse<Viewer>(response);
  if (!Array.isArray(data.chapters) || typeof data.title !== 'string') throw new Error('Invalid viewer response');
  return data;
}
