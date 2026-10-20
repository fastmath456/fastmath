import { Suspense } from 'react';
import { ViewerScreen, ViewerLoading } from '@/features/classroom';

type Props = { params: Promise<{courseId:string}>; searchParams: Promise<Record<string,string|string[]|undefined>> };
async function Screen(props: Props) { const [{courseId},search] = await Promise.all([props.params,props.searchParams]); return <ViewerScreen courseId={courseId} lessonId={typeof search.lesson === 'string' ? search.lesson : undefined} state={typeof search.state === 'string' ? search.state : ''} preview={search.preview === '1'} />; }
export default function Page(props: Props) { return <Suspense fallback={<ViewerLoading />}><Screen {...props} /></Suspense>; }
