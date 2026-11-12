This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Configure `.env.local` using `.env.example`. Development and production both use the real API.

Then run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Storybook

```bash
npm install
npm run storybook
```

[Storybook 열기](http://127.0.0.1:6006). `Atoms → Molecules → Organisms → Templates → Pages` 순서로 기존 UI를 확인할 수 있습니다. 상단 화면 크기 메뉴에서 1440px, 1024px, 390px, 320px을 선택할 수 있습니다.

- `Pages/Payments/Course`와 `Pages/Payments/Book`: 강의와 교재의 결제 진입, 완료, 실패, 취소 화면입니다. `Unknown Order`에는 주문 종류가 없는 실패 화면이 있습니다.
- `Pages/Account`의 `내 정보 수정 완료 팝업`: 테스트 데이터로 정보 수정 버튼을 눌러 실제 팝업을 엽니다.

Storybook은 테스트 데이터로 실행되므로 `.env.local`이 필요 없습니다. 결제창과 영상 재생은 외부 서비스에 연결하지 않습니다. 앱 전체 이동은 Next.js 테스트 라우터가 대신합니다.

```bash
npm run build-storybook  # storybook-static/ 생성
npm run test:storybook   # 모든 App Router 페이지와 두 결제 흐름의 스토리 확인
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
