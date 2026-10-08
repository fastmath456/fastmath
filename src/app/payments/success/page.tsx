import { Suspense } from 'react';
import { ResultScreen } from '@/components/site';

async function Screen({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const params = await searchParams;
  const pdf = params.kind === 'pdf';
  return <ResultScreen title="결제가 완료되었습니다." lines={[]} image="/assets/pay-complete-imgRectangle5.png" actions={[{ label: pdf ? '구매 내역 보기' : '내 강의실', href: pdf ? '/orders' : '/classroom' }]} />;
}
export default function Page(props: { searchParams: Promise<Record<string,string|string[]|undefined>> }) { return <Suspense><Screen {...props} /></Suspense>; }
