import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { ConfirmationDialog } from '@/components/site';

const meta = {
  title: 'Organisms/ConfirmationDialog', component: ConfirmationDialog,
  args: { label: '내 정보가 변경되었습니다.', onCancel: fn(), actions: [{ label: '확인', cancel: true, primary: true }] },
} satisfies Meta<typeof ConfirmationDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ProfileSaved: Story = { args: { children: <p>내 정보가 변경되었습니다.</p>, dimmed: true } };
export const Checkout: Story = {
  args: {
    label: '결제가 필요한 강의입니다.',
    children: <><p>결제가 필요한 강의입니다.</p><p>다음 영상을 확인하시러면 결제가 필요합니다. 결제하시겠습니까?</p></>,
    actions: [{ label: '취소', cancel: true }, { label: '결제', onClick: fn() }],
  },
};
