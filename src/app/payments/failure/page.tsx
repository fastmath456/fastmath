import { Suspense } from 'react';
import { ResultScreen } from '@/components/site';

async function Screen({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const params = await searchParams;
  const pdf = params.kind === 'pdf';
  return <ResultScreen title={params.state === 'cancelled' ? '결제가 취소되었습니다.' : '결제를 완료하지 못했습니다.'} lines={[]} image="/assets/pay-failed-imgRectangle5.png" actions={[{ label: '상품으로 돌아가기', href: pdf ? '/books/exponential-logarithmic-workbook' : '/courses/exponential-logarithmic-core' }]} />;
}
export default function Page(props: { searchParams: Promise<Record<string,string|string[]|undefined>> }) { return <Suspense><Screen {...props} /></Suspense>; }
