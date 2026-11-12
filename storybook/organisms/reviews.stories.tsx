import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { userEvent } from 'storybook/test';
import { ReviewsSection } from '@/features/landing/reviews-section';

const meta = { title: 'Organisms/ReviewsSection', component: ReviewsSection } satisfies Meta<typeof ReviewsSection>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const OriginalReview: Story = {
  name: '후기 원문',
  play: async ({ canvas }) => {
    await userEvent.click((await canvas.findAllByRole('button', { name: '원문 보기' }))[0]);
    await canvas.findByRole('dialog');
  },
};
