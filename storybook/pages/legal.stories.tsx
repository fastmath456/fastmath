import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import CollectionPage from '@/app/privacy/collection/page';
import PrivacyPage from '@/app/privacy/page';
import MarketingPage from '@/app/term/marketing/page';
import TermsPage from '@/app/term/page';
import { navigation } from '../navigation';

const meta = { title: 'Pages/Legal' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Terms: Story = {
  name: '서비스 이용약관', tags: ['route:/term'], parameters: navigation('/term'), render: () => <TermsPage />,
};
export const Privacy: Story = {
  name: '개인정보처리방침', tags: ['route:/privacy'], parameters: navigation('/privacy'), render: () => <PrivacyPage />,
};
export const Collection: Story = {
  name: '개인정보 수집 및 이용 동의', tags: ['route:/privacy/collection'],
  parameters: navigation('/privacy/collection'), render: () => <CollectionPage />,
};
export const Marketing: Story = {
  name: '마케팅 정보 수신 동의', tags: ['route:/term/marketing'], parameters: navigation('/term/marketing'), render: () => <MarketingPage />,
};
