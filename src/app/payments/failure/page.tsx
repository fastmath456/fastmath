import { Suspense } from 'react';
import { ResultScreen } from '@/components/site';
import styles from './payment-failure.module.css';

async function Screen({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const params = await searchParams;
  const pdf = params.kind === 'pdf';
  const productHref = pdf ? '/books/exponential-logarithmic-workbook' : '/courses/exponential-logarithmic-core';

  return <ResultScreen
    title={params.state === 'cancelled' ? '결제가 취소되었습니다.' : '결제를 완료하지 못했습니다.'}
    lines={[]}
    image="/assets/pay-failed-imgRectangle5.png"
    actions={[{ label: '상품으로 돌아가기', href: productHref }]}
    mobileTitle="결제실패"
    mobileBackHref={productHref}
    mobileContent={params.state === 'cancelled' ? undefined : {
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
