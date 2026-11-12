import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Logo } from '@/components/site';

const meta = { title: 'Atoms/Logo', component: Logo, parameters: { layout: 'centered' } } satisfies Meta<typeof Logo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { large: false } };
export const Large: Story = { args: { large: true } };
