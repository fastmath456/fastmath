import { Suspense } from 'react';
import { ResultScreen } from '@/components/site';
import { CoursePaymentFailure } from '@/features/payments/course-payment-failure';
import styles from './payment-failure.module.css';

async function Screen({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const params = await searchParams;
  const pdf = params.kind === 'pdf';
  const cancelled = params.state === 'cancelled';
  const productHref = pdf ? '/books/exponential-logarithmic-workbook' : '/courses/exponential-logarithmic-core';

  if (params.kind === 'vod' && !cancelled) {
    const orderId = typeof params.orderId === 'string' ? params.orderId : undefined;
    const requestKey = typeof params.requestKey === 'string' ? params.requestKey : undefined;
    return <CoursePaymentFailure key={orderId ?? requestKey} orderId={orderId} requestKey={requestKey} backHref={productHref} className={styles.failureResult} />;
  }

  return <ResultScreen
    title={cancelled ? '결제가 취소되었습니다.' : '결제를 완료하지 못했습니다.'}
    lines={[]}
    image="/assets/pay-failed-imgRectangle5.png"
    actions={[{ label: '상품으로 돌아가기', href: productHref }]}
    mobileTitle="결제실패"
    mobileBackHref={productHref}
    mobileContent={cancelled ? undefined : {
      title: '결제에 실패했습니다',
      lines: ['결제를 완료하지 못했어요.', '결제 정보를 확인한 후 다시 시도해 주세요.'],
      actions: [
        { label: '다시 결제하기', variant: 'primary' },
        { label: '다른 강의보기', href: '/courses', variant: 'outline' },
      ],
    }}
    className={styles.failureResult}
  />;
}
export default function Page(props: { searchParams: Promise<Record<string,string|string[]|undefined>> }) { return <Suspense><Screen {...props} /></Suspense>; }
