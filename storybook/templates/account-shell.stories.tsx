import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AccountShell } from '@/features/account';
import { profile } from '../fixtures';

const meta = {
  title: 'Templates/AccountShell', component: AccountShell,
  args: { profile, section: 'profile', children: <h1>내 정보</h1> },
} satisfies Meta<typeof AccountShell>;
export default meta;
export const Default: StoryObj<typeof meta> = {};
