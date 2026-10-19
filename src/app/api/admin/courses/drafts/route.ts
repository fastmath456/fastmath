import { api, courseDrafts, createCourseDraft } from '@/server';
export const GET = api(courseDrafts);
export const POST = api(createCourseDraft);
