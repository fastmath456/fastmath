import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import BookPage from '@/app/books/[slug]/page';
import FailurePage from '@/app/payments/failure/page';
import SuccessPage from '@/app/payments/success/page';
import { book, bookOrder } from '../fixtures';
import { checkoutProduct } from '../handlers';
import { navigation } from '../navigation';

const meta = { title: 'Pages/Payments/Book' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Checkout: Story = {
  name: '교재 결제 진입',
  tags: ['route:/books/[slug]'],
  parameters: { ...navigation(`/books/${book.slug}`), msw: { handlers: { product: checkoutProduct(book) } } },
  render: () => <BookPage params={Promise.resolve({ slug: book.slug })} searchParams={Promise.resolve({})} />,
};

export const Success: Story = {
  name: '교재 결제 완료',
  tags: ['route:/payments/success'],
  parameters: navigation('/payments/success'),
  render: () => <SuccessPage searchParams={Promise.resolve({ orderId: bookOrder.id })} />,
};

export const Failure: Story = {
  name: '교재 결제 실패 · 상품 복귀',
  tags: ['route:/payments/failure'],
  parameters: navigation('/payments/failure'),
  render: () => <FailurePage searchParams={Promise.resolve({ kind: 'pdf', productId: book.id })} />,
};

export const UnknownProduct: Story = {
  name: '교재 결제 실패 · 상품을 찾지 못함',
  parameters: navigation('/payments/failure'),
  render: () => <FailurePage searchParams={Promise.resolve({ kind: 'pdf' })} />,
};

export const Cancelled: Story = {
  name: '교재 결제 취소 화면',
  parameters: navigation('/payments/failure'),
  render: () => <FailurePage searchParams={Promise.resolve({ kind: 'pdf', state: 'cancelled', productId: book.id })} />,
};
