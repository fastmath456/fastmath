import { adminRefund, api, reviewRefund } from '@/server';
export const GET = api(adminRefund);
export const POST = api(reviewRefund);
