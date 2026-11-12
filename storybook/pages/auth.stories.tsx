import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import LoginPage from '@/app/login/page';
import ResetPage from '@/app/reset-password/new/page';
import RecoveryPage from '@/app/reset-password/page';
import SignupCompletePage from '@/app/signup/complete/page';
import SignupPage from '@/app/signup/page';
import { navigation } from '../navigation';

const meta = { title: 'Pages/Auth' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Login: Story = {
  name: '로그인', tags: ['route:/login'], parameters: navigation('/login'), render: () => <LoginPage />,
};
export const Signup: Story = {
  name: '회원가입', tags: ['route:/signup'], parameters: navigation('/signup'), render: () => <SignupPage />,
};
export const SignupComplete: Story = {
  name: '회원가입 완료', tags: ['route:/signup/complete'], parameters: navigation('/signup/complete'), render: () => <SignupCompletePage />,
};
export const PasswordRecovery: Story = {
  name: '비밀번호 찾기', tags: ['route:/reset-password'], parameters: navigation('/reset-password'), render: () => <RecoveryPage />,
};
export const PasswordReset: Story = {
  name: '비밀번호 재설정', tags: ['route:/reset-password/new'], parameters: navigation('/reset-password/new'), render: () => <ResetPage />,
};
