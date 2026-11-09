'use client';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ResultScreen } from '@/components/site';
import { readResponse } from '@/lib/http';
import { useLoginRedirect } from '@/features/auth';
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
  const pdf=query.data?.kind==='pdf';
  return <ResultScreen title="결제가 완료되었습니다." lines={[]} image="/assets/pay-complete-imgRectangle5.png" actions={[{label:pdf?'구매 내역 보기':'내 강의실',href:pdf?'/orders':'/classroom'}]} mobileTitle="결제완료" mobileContent={{title:'결제에 성공했습니다',lines:['구매하신 상품을 이제 이용하실 수 있어요.','빠른수학과 함께 수학 공부를 시작해 보세요.'],actions:[{label:'내 수강실로',href:pdf?'/orders':'/classroom',variant:'primary'},{label:'다른 강의보기',href:'/courses',variant:'outline'}]}} />;
}
