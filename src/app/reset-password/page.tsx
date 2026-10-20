import { AuthForm } from '@/features/auth';

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <AuthForm kind="recovery" searchParams={searchParams} />;
}
