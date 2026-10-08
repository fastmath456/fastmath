import type { Metadata } from "next";
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: "빠른수학",
  description: "여러분의 수학 공부 시간을 1초라도 줄여드리고 싶어서 만들었습니다",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
