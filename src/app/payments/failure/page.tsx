import { Suspense } from 'react';
import { ResultScreen } from '@/components/site';
import { PaymentFailure } from '@/features/payments/payment-failure';
import { checkoutProductReturnHref } from '@/server';
import styles from './payment-failure.module.css';

async function Screen({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const params = await searchParams;
  const { kind } = params;
  const cancelled = params.state === 'cancelled';
  const productHref = kind === 'vod' || kind === 'pdf' ? await checkoutProductReturnHref(params.productId, kind) : null;
  const backHref = productHref ?? '/courses';

  if (!cancelled) {
    const orderId = kind === 'vod' && typeof params.orderId === 'string' ? params.orderId : undefined;
    const requestKey = kind === 'vod' && typeof params.requestKey === 'string' ? params.requestKey : undefined;
    const retryOrder = orderId || requestKey ? { orderId, requestKey } : undefined;
    if (kind === 'pdf' || productHref || retryOrder) {
      return <PaymentFailure key={orderId ?? requestKey} retryOrder={retryOrder} backHref={backHref} className={styles.failureResult} />;
    }
  }

  const browseActions = [{ label: '다른 강의보기', href: '/courses', variant: 'outline' as const }];
  return <ResultScreen
    title={cancelled ? '결제가 취소되었습니다.' : '결제를 완료하지 못했습니다.'}
    lines={[]}
    image="/assets/pay-failed-imgRectangle5.png"
    actions={cancelled ? [{ label: '상품으로 돌아가기', href: backHref }] : browseActions}
    mobileTitle="결제실패"
    mobileBackHref={backHref}
    mobileContent={cancelled ? undefined : {
      title: '결제에 실패했습니다',
      lines: ['결제를 완료하지 못했어요.', '결제 정보를 확인한 후 다시 시도해 주세요.'],
      actions: browseActions,
    }}
    className={styles.failureResult}
  />;
}
export default function Page(props: { searchParams: Promise<Record<string,string|string[]|undefined>> }) { return <Suspense><Screen {...props} /></Suspense>; }
