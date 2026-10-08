import { Suspense } from 'react';
import { AuthForm } from '@/features/auth';

async function Screen({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <AuthForm kind="signup" scenario={typeof params.state === 'string' ? params.state : ''} />;
}

export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense><Screen {...props} /></Suspense>;
}
