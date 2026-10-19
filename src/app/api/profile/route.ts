import { api, profile, saveProfile } from '@/server';
export const GET = api(profile);
export const PATCH = api(saveProfile);
