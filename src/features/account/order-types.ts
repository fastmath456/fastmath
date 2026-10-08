export type Order = { id: string; title: string; kind: 'vod' | 'pdf'; status: string; amount: number; endDate: string; progress: string; paidDate: string; refundLabel: string; refundable: boolean };
export type Orders = { items: Order[]; count: number };
export type RefundQuote = { orderId: string; title: string; text: string };
