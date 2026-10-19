import { api, manageCurriculum, manageFile } from '@/server';
export const POST = api(manageCurriculum);
export const PUT = api(manageFile);
