import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import CoursePage from '@/app/courses/[slug]/page';
import FailurePage from '@/app/payments/failure/page';
import SuccessPage from '@/app/payments/success/page';
import { course, courseOrder } from '../fixtures';
import { checkoutProduct } from '../handlers';
import { navigation } from '../navigation';

const meta = { title: 'Pages/Payments/Course' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Checkout: Story = {
  name: '강의 결제 진입',
  tags: ['route:/courses/[slug]'],
  parameters: { ...navigation(`/courses/${course.slug}`), msw: { handlers: { product: checkoutProduct(course) } } },
  render: () => <CoursePage params={Promise.resolve({ slug: course.slug })} searchParams={Promise.resolve({})} />,
};

export const Success: Story = {
  name: '강의 결제 완료',
  tags: ['route:/payments/success'],
  parameters: navigation('/payments/success'),
  render: () => <SuccessPage searchParams={Promise.resolve({ orderId: courseOrder.id })} />,
};

export const Failure: Story = {
  name: '강의 결제 실패',
  tags: ['route:/payments/failure'],
  parameters: navigation('/payments/failure'),
  render: () => <FailurePage searchParams={Promise.resolve({ kind: 'vod', orderId: courseOrder.id, productId: course.id })} />,
};

export const Cancelled: Story = {
  name: '강의 결제 취소 화면',
  parameters: navigation('/payments/failure'),
  render: () => <FailurePage searchParams={Promise.resolve({ kind: 'vod', state: 'cancelled', productId: course.id })} />,
};
