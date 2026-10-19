import { dataPath, readResponse } from '@/lib/http';
import type { Orders, RefundQuote } from './order-types';

export async function getOrders(state: string): Promise<Orders> {
  const response = await fetch(dataPath(`/__mock/orders?state=${encodeURIComponent(state)}`,'/api/orders'));
  const data = await readResponse<Orders>(response);
  if (!Array.isArray(data.items) || !Number.isInteger(data.count) || data.count < 0 || !data.items.every(item => item && ['vod','pdf'].includes(item.kind) && Number.isSafeInteger(item.amount) && item.amount >= 0 && [item.id,item.title,item.status,item.endDate,item.progress,item.paidDate,item.refundLabel].every(value => typeof value === 'string') && typeof item.refundable === 'boolean')) throw new Error('Invalid orders response');
  return data;
}
export async function getRefundQuote(orderId: string, state: string): Promise<RefundQuote> {
  const response = await fetch(dataPath(`/__mock/orders/${encodeURIComponent(orderId)}/refund?state=${encodeURIComponent(state)}`,`/api/orders/${encodeURIComponent(orderId)}/refund-quote`));
  const data = await readResponse<RefundQuote>(response);
  if (data.orderId !== orderId || typeof data.title !== 'string' || typeof data.text !== 'string') throw new Error('Invalid refund quote response');
  return data;
}
