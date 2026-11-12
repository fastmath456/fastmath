import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { http } from 'msw';
import HomePage from '@/app/page';
import { apiError } from '../handlers';
import { navigation } from '../navigation';

const meta = {
  title: 'Pages/Home', component: HomePage, tags: ['route:/'],
  parameters: { ...navigation('/'), msw: { handlers: { profile: http.get('/api/profile', () => apiError(401, 'unauthorized')) } } },
} satisfies Meta<typeof HomePage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Home: Story = { name: '홈' };
export const NarrowMobile: Story = { name: '홈 · 320px', globals: { viewport: { value: 'narrow', isRotated: false } } };
