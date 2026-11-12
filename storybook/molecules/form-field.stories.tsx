import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FormField } from '@/components/site';

const meta = {
  title: 'Molecules/FormField', component: FormField, parameters: { layout: 'centered' },
  decorators: [Story => <div style={{ width: 320, maxWidth: 'calc(100vw - 32px)' }}><Story /></div>],
  args: { id: 'storybook-email', label: '이메일', placeholder: '이메일을 입력해주세요.' },
} satisfies Meta<typeof FormField>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Error: Story = { args: { defaultValue: 'student', error: '이메일 형식을 확인해주세요.' } };
export const ReadOnly: Story = { args: { readOnly: true, value: 'student@example.test' } };
export const Password: Story = {
  args: { id: 'storybook-password', type: 'password', label: '비밀번호', placeholder: '비밀번호를 입력해주세요.', description: '비밀번호는 8자 이상 입력해 주세요.' },
};
