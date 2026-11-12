import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Skeleton } from '@/components/site';

const meta = {
  title: 'Atoms/Skeleton', component: Skeleton, parameters: { layout: 'centered' },
} satisfies Meta<typeof Skeleton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Text: Story = { args: { children: '강의·교재 목록(00)' } };
