import { mutate, readResponse } from '@/lib/http';
import type { AdminRefund, AdminRefundDetail } from './refunds-types';

export async function getRefunds() {
  const data = await readResponse<{ items: AdminRefund[] }>(await fetch('/api/admin/refunds', { credentials: 'same-origin' }));
  if (!Array.isArray(data.items)) throw new Error('Invalid refunds response');
  return data.items;
}
export async function getRefund(orderId: string) {
  const data = await readResponse<AdminRefundDetail>(await fetch(`/api/admin/refunds/${encodeURIComponent(orderId)}`, { credentials: 'same-origin' }));
  if (data.orderId !== orderId) throw new Error('Invalid refund response');
  return data;
}
export const reviewRefund = (orderId: string, approve: boolean, amount: number, reason: string) =>
  mutate<{ status: string }>(`admin/refunds/${encodeURIComponent(orderId)}`, { approve, amount, reason });
export const recoverRefund = (orderId: string) => mutate<{ status?: string; ok?: boolean }>(`admin/orders/${encodeURIComponent(orderId)}/recover`);
