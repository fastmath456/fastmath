import { Suspense } from 'react';
import { ManageCourseScreen } from '@/features/manage';
import { ResetOnLeave } from '@/components/site';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
async function Screen({ searchParams }: Props) {
  const search = await searchParams;
  return <ResetOnLeave><ManageCourseScreen draftId={typeof search.draft === 'string' ? search.draft : undefined} stepValue={typeof search.step === 'string' ? search.step : undefined} /></ResetOnLeave>;
}
export default function Page(props: Props) { return <Suspense><Screen {...props} /></Suspense>; }
