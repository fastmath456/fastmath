import { Suspense } from 'react';
import { OrdersScreen } from '@/features/account';

async function Screen({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) { const search = await searchParams; return <OrdersScreen state={typeof search.state === 'string' ? search.state : ''} />; }
export default function Page(props: { searchParams: Promise<Record<string,string|string[]|undefined>> }) { return <Suspense><Screen {...props} /></Suspense>; }
