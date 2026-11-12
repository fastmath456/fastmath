import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ResultScreen } from '@/components/site';

const meta = { title: 'Templates/ResultScreen', component: ResultScreen } satisfies Meta<typeof ResultScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Completed: Story = { args: {
  title: '결제에 성공했습니다', image: '/assets/pay-complete-imgRectangle5.png', mobileTitle: '결제완료',
  lines: ['구매하신 상품을 이제 이용하실 수 있어요.', '빠른수학과 함께 수학 공부를 시작해 보세요.'],
  actions: [{ label: '내 수강실로', href: '/classroom', variant: 'primary' }, { label: '다른 강의보기', href: '/courses', variant: 'outline' }],
} };
