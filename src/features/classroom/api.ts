import { dataPath } from '@/lib/http';
import type { Classroom, Viewer } from './types';

export async function getClassroom(state: string): Promise<Classroom> {
  const response = await fetch(dataPath(`/__mock/classroom?state=${encodeURIComponent(state)}`,'/api/classroom'));
  if (!response.ok) throw new Error('Classroom request failed');
  const data: Classroom = await response.json();
  if (!Array.isArray(data.items) || !Number.isInteger(data.count)) throw new Error('Invalid classroom response');
  return data;
}
export async function getViewer(courseId: string, state: string): Promise<Viewer> {
  const response = await fetch(dataPath(`/__mock/courses/${encodeURIComponent(courseId)}?state=${encodeURIComponent(state)}`,`/api/classroom/courses/${encodeURIComponent(courseId)}`));
  if (!response.ok) throw new Error('Viewer request failed');
  const data: Viewer = await response.json();
  if (!Array.isArray(data.chapters) || typeof data.title !== 'string') throw new Error('Invalid viewer response');
  return data;
}
