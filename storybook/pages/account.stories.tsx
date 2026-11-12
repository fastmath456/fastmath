import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent } from 'storybook/test';
import RefundPage from '@/app/orders/[orderId]/refund/page';
import OrdersPage from '@/app/orders/page';
import ProfilePage from '@/app/profile/page';
import { refundQuote } from '../fixtures';
import { navigation } from '../navigation';

const meta = { title: 'Pages/Account' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Profile: Story = {
  name: '내 정보', tags: ['route:/profile'], parameters: navigation('/profile'),
  render: () => <ProfilePage searchParams={Promise.resolve({})} />,
};

export const ProfileSaved: Story = {
  ...Profile, name: '내 정보 수정 완료 팝업',
  play: async ({ canvas }) => {
    const name = await canvas.findByRole('textbox', { name: '이름' });
    await userEvent.clear(name);
    await userEvent.type(name, '홍수학');
    await userEvent.click(canvas.getByRole('button', { name: '정보수정' }));
    const dialog = await canvas.findByRole('dialog', { name: '내 정보가 변경되었습니다.' });
    await expect(dialog).toBeVisible();
  },
};

export const Orders: Story = {
  name: '내 결제내역', tags: ['route:/orders'], parameters: navigation('/orders'),
  render: () => <OrdersPage searchParams={Promise.resolve({})} />,
};

export const Refund: Story = {
  name: '환불 확인', tags: ['route:/orders/[orderId]/refund'],
  parameters: navigation(`/orders/${refundQuote.orderId}/refund`),
  render: () => <RefundPage searchParams={Promise.resolve({})} />,
};
