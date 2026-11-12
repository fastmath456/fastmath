import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LegalScreen, legalDocuments } from '@/features/legal';

const meta = { title: 'Templates/LegalScreen', component: LegalScreen, args: { document: legalDocuments.terms } } satisfies Meta<typeof LegalScreen>;
export default meta;
export const Terms: StoryObj<typeof meta> = {};
