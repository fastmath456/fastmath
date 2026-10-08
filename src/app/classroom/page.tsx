import { Suspense } from 'react';
import { ClassroomScreen } from '@/features/classroom';

async function Screen({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) { const search = await searchParams; return <ClassroomScreen state={typeof search.state === 'string' ? search.state : ''} />; }
export default function Page(props: { searchParams: Promise<Record<string,string|string[]|undefined>> }) { return <Suspense><Screen {...props} /></Suspense>; }
