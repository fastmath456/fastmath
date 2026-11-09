'use client';

import { useEffect, useRef } from 'react';
import { ResultScreen } from '@/components/site';
import { useLoginRedirect } from '@/features/auth';
import { retryCourseCheckout } from '@/features/catalog';
import styles from './payment-result.module.css';

export function CoursePaymentFailure({ orderId, requestKey, backHref, className }: {
  orderId?: string;
  requestKey?: string;
  backHref: string;
  className: string;
}) {
  const pending = useRef<AbortController | null>(null);
  const { redirectIfUnauthorized } = useLoginRedirect();

  useEffect(() => () => pending.current?.abort(), []);

  function retry() {
    if (pending.current) return;
    const attempt = new AbortController();
    pending.current = attempt;
    void retryCourseCheckout({ orderId, requestKey }, attempt.signal)
      .catch(redirectIfUnauthorized)
      .finally(() => { pending.current = null; });
  }

  return <ResultScreen
    title="결제에 실패했습니다"
    lines={['결제를 완료하지 못했어요.', '결제 정보를 확인한 후 다시 시도해 주세요.']}
    image="/assets/pay-failed-imgRectangle5.png"
    actions={[
      { label: '다시 결제하기', onClick: retry, variant: 'primary' },
      { label: '다른 강의보기', href: '/courses', variant: 'outline' },
    ]}
    mobileTitle="결제실패"
    mobileBackHref={backHref}
    className={`${className} ${styles.courseResult}`}
  />;
}
