import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import FailurePage from '@/app/payments/failure/page';
import { navigation } from '../navigation';

const meta = { title: 'Pages/Payments/Unknown Order', parameters: navigation('/payments/failure') } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Failure: Story = {
  name: '종류를 확인할 수 없는 결제 실패',
  render: () => <FailurePage searchParams={Promise.resolve({})} />,
};
