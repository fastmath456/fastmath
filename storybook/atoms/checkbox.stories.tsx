import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Checkbox } from '@/components/site';

const meta = {
  title: 'Atoms/Checkbox', component: Checkbox, parameters: { layout: 'centered' },
  args: { children: '전체 동의' },
} satisfies Meta<typeof Checkbox>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = { args: { defaultChecked: false } };
export const Checked: Story = { args: { defaultChecked: true } };
