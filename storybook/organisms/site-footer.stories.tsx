import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SiteFooter } from '@/components/site';

const meta = { title: 'Organisms/SiteFooter', component: SiteFooter } satisfies Meta<typeof SiteFooter>;
export default meta;
export const Default: StoryObj<typeof meta> = {};
