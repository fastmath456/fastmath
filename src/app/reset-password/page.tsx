import { AuthForm } from '@/features/auth';
import { ResetOnLeave } from '@/components/site';

export default function Page() {
  return <ResetOnLeave><AuthForm kind="recovery" /></ResetOnLeave>;
}
