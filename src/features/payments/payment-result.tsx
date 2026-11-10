'use client';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ResultScreen } from '@/components/site';
import { readResponse } from '@/lib/http';
import { useLoginRedirect } from '@/features/auth';
import styles from './payment-result.module.css';

export function PaymentResult({orderId}:{orderId?:string}) {
  const query=useQuery({
    queryKey:['payment-status',orderId],
    enabled:Boolean(orderId),
    retry:false,
    queryFn:async()=>readResponse<{status:string;kind:'vod'|'pdf'}>(await fetch(`/api/orders/${encodeURIComponent(orderId!)}/payment-status`)),
  });
  const { requiresLogin } = useLoginRedirect(query.error);
  useEffect(()=> { if(!requiresLogin && (query.isError||!orderId)) location.replace('/payments/failure'); },[query.isError,requiresLogin,orderId]);
  if (requiresLogin || query.data?.status!=='paid') return null;
  const primaryAction = query.data.kind === 'pdf'
    ? { label: '구매 내역 보기', href: '/orders' }
    : { label: '내 수강실로', href: '/classroom' };

  return (
    <ResultScreen
      title="결제에 성공했습니다"
      lines={['구매하신 상품을 이제 이용하실 수 있어요.', '빠른수학과 함께 수학 공부를 시작해 보세요.']}
      actions={[
        { ...primaryAction, variant: 'primary' },
        { label: '다른 강의보기', href: '/courses', variant: 'outline' },
      ]}
      image="/assets/pay-complete-imgRectangle5.png"
      mobileTitle="결제완료"
      className={styles.courseResult}
    />
  );
}
