import type { AdminCourse, AdminCourseFilter, AdminCourseStatus } from './courses-types';

export const courseStatusLabels: Record<AdminCourseStatus, string> = { selling: '판매 중', stopped: '판매 중지', draft: '임시저장' };
export const courseFilters: { value: AdminCourseFilter; label: string }[] = [
  { value: 'all', label: '전체' }, { value: 'selling', label: '판매 중' }, { value: 'stopped', label: '판매 중지' }, { value: 'draft', label: '임시저장' },
];
export function matchesCourse(item: AdminCourse, filter: AdminCourseFilter, search: string) {
  if (filter !== 'all' && item.status !== filter) return false;
  const query = search.trim().toLowerCase();
  return !query || item.title.toLowerCase().includes(query);
}
export const courseTitle = (item: Pick<AdminCourse, 'title'>) => item.title.trim() || '제목 없음';
/** Where the row's main action goes: a draft reopens the form where it stopped, a course opens its edit form. */
export function courseEditHref(item: Pick<AdminCourse, 'id' | 'status' | 'step'>) {
  return item.status === 'draft' ? `/manage/courses/new?draft=${encodeURIComponent(item.id)}&step=${item.step}` : `/manage/courses/${encodeURIComponent(item.id)}/edit`;
}
export function courseViewHref(item: Pick<AdminCourse, 'status' | 'kind' | 'slug'>) {
  return item.status === 'draft' || !item.slug ? null : `/${item.kind === 'vod' ? 'courses' : 'books'}/${encodeURIComponent(item.slug)}`;
}
