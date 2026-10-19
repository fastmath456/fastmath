import { legalDocuments, LegalScreen } from '@/features/legal';

const document = legalDocuments.terms;
export const metadata = { title: `${document.title} | 빠른수학` };

export default function Page() {
  return <LegalScreen document={document} />;
}
