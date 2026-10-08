import { Suspense } from 'react';
import { ProfileScreen } from '@/features/account';

async function Screen({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) { const search = await searchParams; return <ProfileScreen state={typeof search.state === 'string' ? search.state : ''} />; }
export default function Page(props: { searchParams: Promise<Record<string,string|string[]|undefined>> }) { return <Suspense><Screen {...props} /></Suspense>; }
