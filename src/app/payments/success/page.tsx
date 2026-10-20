import { Suspense } from 'react';
import { PaymentResult } from '@/features/payments/payment-result';

async function Screen({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const params = await searchParams;
  return <PaymentResult paymentKey={typeof params.paymentKey==='string'?params.paymentKey:undefined} orderId={typeof params.orderId==='string'?params.orderId:undefined} amount={typeof params.amount==='string'?params.amount:undefined} />;
}
export default function Page(props: { searchParams: Promise<Record<string,string|string[]|undefined>> }) { return <Suspense><Screen {...props} /></Suspense>; }
