import { api, courseDraft, saveCourseDraft } from '@/server';
export const GET = api(courseDraft);
export const PATCH = api(saveCourseDraft);
