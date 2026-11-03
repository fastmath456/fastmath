import { Suspense } from 'react';
import { ManageCourseScreen } from '@/features/manage';
import { ResetOnLeave } from '@/components/site';

type Props = { params: Promise<{ courseId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
async function Screen({ params, searchParams }: Props) {
  const [{ courseId }, search] = await Promise.all([params, searchParams]);
  return <ResetOnLeave><ManageCourseScreen courseId={courseId} draftId={typeof search.draft === 'string' ? search.draft : undefined} stepValue={typeof search.step === 'string' ? search.step : undefined} /></ResetOnLeave>;
}
export default function Page(props: Props) { return <Suspense><Screen {...props} /></Suspense>; }
