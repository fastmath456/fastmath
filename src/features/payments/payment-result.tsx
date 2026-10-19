'use client';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ResultScreen } from '@/components/site';
import { isMockMode, mutate } from '@/lib/http';
export function PaymentResult({paymentKey,orderId,amount,kind}:{paymentKey?:string;orderId?:string;amount?:string;kind?:string}) {
  const query=useQuery({queryKey:['payment-confirm',orderId,paymentKey],enabled:!isMockMode&&Boolean(orderId&&paymentKey),retry:false,queryFn:()=>mutate<{ok:boolean;kind:string}>('payments/confirm',{paymentKey,orderId,amount:Number(amount)})});
  useEffect(()=> { if(!isMockMode && (query.isError||!orderId||!paymentKey)) location.replace('/payments/failure'); },[query.isError,orderId,paymentKey]);
  if(!isMockMode && !query.data?.ok) return null;
  const pdf=(isMockMode?kind:query.data?.kind)==='pdf';
  return <ResultScreen title="결제가 완료되었습니다." lines={[]} image="/assets/pay-complete-imgRectangle5.png" actions={[{label:pdf?'구매 내역 보기':'내 강의실',href:pdf?'/orders':'/classroom'}]} />;
}
