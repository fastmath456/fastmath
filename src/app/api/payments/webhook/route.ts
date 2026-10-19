import { api, paymentWebhook } from '@/server';
export const POST = api(paymentWebhook, true);
