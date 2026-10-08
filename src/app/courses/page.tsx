import { Suspense } from 'react';
import { ProductListScreen } from '@/features/catalog';

async function Screen({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <ProductListScreen sortValue={typeof params.sort === 'string' ? params.sort : undefined} state={typeof params.state === 'string' ? params.state : ''} />;
}
export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <Suspense><Screen {...props} /></Suspense>; }
