import { RequestError } from '@/lib/http';
import type { AssetSlot, CourseAsset, CourseDocument, CourseDraft, CourseVideo, DraftSummary } from './types';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch('/api/admin/courses/' + path, { ...options, credentials: 'same-origin' });
  const data = await response.json();
  if (!response.ok) throw new RequestError(data.error?.code ?? 'request_failed', data.error?.field);
  return data as T;
}
const json = (value: unknown, method = 'POST'): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
export const checkAccess = () => request<{ admin: true }>('access');
export const getDrafts = () => request<{ items: DraftSummary[] }>('drafts');
export const getDraft = (id: string) => request<{ draft: CourseDraft }>('drafts/' + encodeURIComponent(id));
export const getEditableCourse = (id: string) => request<{ draft: CourseDraft }>(encodeURIComponent(id));
export const saveDraft = (document: CourseDocument, draft: CourseDraft | null, courseId?: string) => draft?.id ? request<{ draft: CourseDraft }>('drafts/' + encodeURIComponent(draft.id), json({ document, revision: draft.revision }, 'PATCH')) : request<{ draft: CourseDraft }>('drafts', json({ document, ...(courseId ? { courseId } : {}) }));
export const publishDraft = (draft: CourseDraft) => request<{ courseId: string; slug: string }>('drafts/' + encodeURIComponent(draft.id) + '/publish', json({ revision: draft.revision }));
export const verifyVideo = (url: string) => request<{ video: CourseVideo }>('videos/verify', json({ url }));
export function uploadAsset(slot: AssetSlot, file: File, signal: AbortSignal) {
  const body = new FormData(); body.set('slot', slot); body.set('file', file);
  return request<{ asset: CourseAsset }>('uploads', { method: 'POST', body, signal });
}
