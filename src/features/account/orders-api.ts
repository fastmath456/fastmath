import type { Orders, RefundQuote } from './order-types';

export async function getOrders(state: string): Promise<Orders> {
  const response = await fetch(`/__mock/orders?state=${encodeURIComponent(state)}`);
  if (!response.ok) throw new Error('Orders request failed');
  const data: Orders = await response.json();
  if (!Array.isArray(data.items) || !Number.isInteger(data.count) || data.count < 0 || !data.items.every(item => item && ['vod','pdf'].includes(item.kind) && Number.isSafeInteger(item.amount) && item.amount >= 0 && [item.id,item.title,item.status,item.endDate,item.progress,item.paidDate,item.refundLabel].every(value => typeof value === 'string') && typeof item.refundable === 'boolean')) throw new Error('Invalid orders response');
  return data;
}
export async function getRefundQuote(orderId: string, state: string): Promise<RefundQuote> {
  const response = await fetch(`/__mock/orders/${encodeURIComponent(orderId)}/refund?state=${encodeURIComponent(state)}`);
  if (!response.ok) throw new Error('Refund quote request failed');
  const data: RefundQuote = await response.json();
  if (data.orderId !== orderId || typeof data.title !== 'string' || typeof data.text !== 'string') throw new Error('Invalid refund quote response');
  return data;
}
