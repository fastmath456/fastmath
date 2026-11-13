export type RefundStatus = 'review' | 'processing' | 'completed' | 'rejected';
export type AdminRefund = {
  orderId: string; requestedAt: string; status: RefundStatus; external: boolean;
  name: string; email: string; title: string; kind: 'vod' | 'pdf';
  paidAmount: number; refundAmount: number; usedSeconds: number; totalSeconds: number; downloaded: boolean;
};
export type AdminRefundPayment = { status: string; cancelledAmount: number; balance: number; partialCancel: boolean };
export type AdminRefundDetail = Omit<AdminRefund, 'downloaded'> & {
  reason: string | null; paidAt: string | null; progress: number | null; downloads: number;
  startsAt: string | null; expiresAt: string | null; cancelStartedAt: string | null; payment: AdminRefundPayment | null;
};
export type RefundFilter = 'all' | RefundStatus;
