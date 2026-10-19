import { api, orders, createOrder } from '@/server';
export const GET = api(orders);
export const POST = api(createOrder);
