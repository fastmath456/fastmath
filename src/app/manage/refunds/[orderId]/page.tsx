import { Suspense } from 'react';
import { ManageRefundScreen } from '@/features/manage';

type Props = { params: Promise<{ orderId: string }> };
async function Screen({ params }: Props) {
  const { orderId } = await params;
  return <ManageRefundScreen orderId={orderId} />;
}
export default function Page(props: Props) { return <Suspense><Screen {...props} /></Suspense>; }
