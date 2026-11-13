import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SiteHeader } from '@/components/site';
import { profile } from '../fixtures';

const meta = { title: 'Organisms/SiteHeader', component: SiteHeader } satisfies Meta<typeof SiteHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Guest: Story = {};
export const SignedIn: Story = { args: { profile: { name: profile.name, image: profile.avatar } } };
export const Admin: Story = { args: { profile: { name: profile.name, image: profile.avatar, admin: true } } };
export const Loading: Story = { args: { profileLoading: true } };
export const MobileMenu: Story = {
  ...SignedIn, globals: { viewport: { value: 'mobile', isRotated: false } },
};
export const MobileBack: Story = {
  args: { mobile: { title: '결제완료', href: '/courses' } },
  globals: { viewport: { value: 'mobile', isRotated: false } },
};
