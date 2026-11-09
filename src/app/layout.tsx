import type { Metadata } from "next";
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  metadataBase: new URL('https://quick-math-tawny.vercel.app'),
  title: "빠른수학",
  description: "여러분의 수학 공부 시간을 1초라도 줄여드리고 싶어서 만들었습니다",
  verification: {
    other: { 'naver-site-verification': '5f28ceb9eb105d4aae4bfeed7cc3b4120fea45e9' },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
