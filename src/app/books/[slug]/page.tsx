import { Suspense } from 'react';
import { ProductDetailScreen, ProductDetailLoading } from '@/features/catalog';

type Props = { params: Promise<{slug:string}>; searchParams: Promise<Record<string,string|string[]|undefined>> };
async function Screen(props: Props) {
  const [{slug}, search] = await Promise.all([props.params, props.searchParams]);
  return <ProductDetailScreen slug={slug} kind="pdf" state={typeof search.state === 'string' ? search.state : ''} view={typeof search.view === 'string' ? search.view : ''} />;
}
export default function Page(props: Props) { return <Suspense fallback={<ProductDetailLoading kind="pdf" />}><Screen {...props} /></Suspense>; }
