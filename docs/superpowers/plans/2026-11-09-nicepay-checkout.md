# 나이스페이 카드 결제 연동 및 토스 제거 계획

> 와이어프레임 검토와 구현 승인 후 `superpowers:executing-plans`로 아래 항목을 순서대로 진행한다.

**목표** VOD와 PDF의 신규 카드 결제를 나이스페이로 전환하고 토스 연동 코드를 제거한다.

**구조** 브라우저는 나이스페이 JS SDK로 인증한다. Next.js 서버는 인증 결과를 검증한 뒤 START REST API로 승인하고, 승인 결과를 확인한 뒤 Supabase에서 주문과 이용권을 한 트랜잭션으로 확정한다. 토스 연동 제거와 신규 결제 전환은 같은 배포로 묶는다. [START 개발 가이드](https://start.nicepay.co.kr/manual/admin/developers/info.do)

**기술** Next.js 16.4 Route Handler, Supabase RPC, NICEPAY START 서버 승인·Basic 인증, Node 내장 `fetch`와 `crypto`.

**근거** 사용자가 신규 주문의 나이스페이 전환과 토스 코드 전체 삭제를 요청했다. 결제수단은 현재의 원화 카드 단건 결제를 기준으로 한다. `start-api-mcp`는 개발 도구에서 연동을 탐색하는 데 참고하고, 앱은 JS SDK와 REST API를 호출한다. [공식 MCP 저장소](https://github.com/nicepayments/start-api-mcp), [키 발급 및 인증](https://github.com/nicepayments/nicepay-manual/blob/main/common/api.md)

## 공통 기준

- 상품 상세와 강의 미리보기의 구매 버튼, 공용 `ConfirmationDialog`와 `ResultScreen`, PDF 구매 내역과 VOD 강의실 연결을 재사용한다.
- 서버에서 주문 금액을 원 단위 정수로 확정한다. 로그인, 주문 소유권, 구매 중복 방지, 강의 스냅샷, 상품별 이용기간과 환불 견적은 기존 로직을 재사용한다.
- `.env.example`에 `NICEPAY_ENV`, `NICEPAY_CLIENT_ID`, `NICEPAY_SECRET_KEY`를 명시한다. 기본값은 `sandbox`다. `pay.nicepay.co.kr/v1/js/`에서 SDK를 읽으면 SDK가 `S2_` 키를 샌드박스 결제창으로 연결한다. 서버는 `NICEPAY_ENV`에 맞는 API 호스트와 키 접두사를 확인한다. 브라우저에는 클라이언트 ID만 전달한다. 운영 승인·취소는 `ALLOW_LIVE_PAYMENTS=true`에서만 허용한다. 콜백 주소는 `APP_ORIGIN`에서 구성한다. [나이스페이 테스트 매뉴얼](https://github.com/nicepayments/nicepay-manual/blob/main/common/test.md#샌드박스를-통한-test)
- 새 금융 테이블과 RPC는 RLS와 명시적 권한으로 `service_role`에만 열고 생성 타입을 갱신한다. 개발 검증은 전용 로컬 DB와 테스트 상점에서 진행한다. [Supabase API 권한](https://supabase.com/docs/guides/api/securing-your-api)

## 중점 검증

| 상황 | 통과 조건 |
| --- | --- |
| 금액·서명·콜백 토큰 조작, 타인 결과 조회 | 승인 0건, 이용권 0건, 타인 주문 정보 노출 0건 |
| 같은 결제의 인증 콜백과 웹훅 동시 도착 | 승인 요청 1회, 주문 확정 및 이용권 각각 1건 |
| 승인 읽기 시간 초과 또는 승인 직후 DB 저장 실패 | 망취소 또는 거래 조회로 최종 상태 대조, 이중 승인 0건 |
| 부분취소 응답 유실 및 동일 환불 재시도 | 동일 취소 요청 식별자로 대조, 중복 취소 0건 |
| 기존 토스 주문을 조회하거나 결제 재시도 | 구매 이력과 이용권 조회 가능, 기존 토스 거래키가 나이스페이에 전달되는 요청 0건 |

## 1. 전환 조건과 주문 모델 확정

**대상** `supabase/migrations/`, `src/server/database.types.ts`, `src/server/orders.ts`, `.env.example`.

- [ ] 테스트 상점에서 서버 승인·Basic 키를 준비한다. 운영 상점의 카드 결제·부분취소 지원과 VOD·PDF 상품별 세금 구분을 확인한다. [테스트 상점 가이드](https://github.com/nicepayments/nicepay-manual/blob/main/common/test.md#샌드박스test)
- [ ] 전환 전에 운영 DB와 PG 내역에서 기존 승인 대기·환불 처리 중 거래를 대조한다. 실거래가 있으면 기존 주문의 환불 처리 방법과 책임자를 확정한다. 전환 시 기존 주문·거래키·이용권·환불 기록을 보존한다.
- [ ] `create_order`의 기존 대기 주문 재사용과 강의 스냅샷을 유지한다. 서버 전용 `nicepay_attempts`에서 내부 주문 ID와 PG에 보낼 고유 시도 ID를 연결한다. 원승인 `tid`와 승인 진행·망취소 진행·확정 결과를 기록한다. 주문별 활성 시도를 하나로 제한한다. 창을 닫으면 대기 주문을 다시 사용한다. 승인 호출을 시작한 뒤에는 실패·만료·망취소가 확인된 시도에 한해 다음 시도를 연다. 이전 토스 결제창이 정리된 뒤 결제키가 없는 대기 주문만 나이스페이 결제를 시작할 수 있게 한다.
- [ ] 기존 주문을 넣은 전용 DB에 새 마이그레이션을 적용한다. 기존 주문의 조회와 이용권 접근을 비교하고, 동시 결제 시작 시 활성 시도가 하나인지 확인한다. 결제키가 있는 이전 주문은 운영 대조 없이 새 결제에 연결할 수 없어야 한다.

## 2. 카드 결제창과 서버 승인 연결

**대상** `src/features/catalog/checkout.ts`, `src/server/orders.ts`, 신규 `src/server/nicepay.ts`, `src/app/api/payments/nicepay/callback/route.ts`, `src/app/api/orders/[orderId]/payment-status/route.ts`, `src/app/payments/success/page.tsx`, `src/features/payments/payment-result.tsx`.

- [ ] `POST /api/orders`는 기존 `productId`와 `requestKey`를 받고 나이스페이의 `clientId`, `orderId`(시도 ID), `amount`, `goodsName`, `returnUrl`을 돌려준다. 결제 SDK에 `method: 'card'`로 전달한다. 상품명이 SDK의 40바이트 제한을 넘는 경우를 샌드박스에서 검증한다. `ProductDetailScreen`과 `ViewerScreen`은 공용 `checkout`을 통해 연결한다. [서버 승인 결제창 명세](https://github.com/nicepayments/nicepay-manual/blob/main/api/payment-window-server.md)
- [ ] `POST /api/payments/nicepay/callback`에서 `application/x-www-form-urlencoded` 인증 결과를 처리한다. 결제 관련 외부 POST는 콜백·웹훅 경로로 제한한다. 세션 쿠키와 별개로 서버가 발급한 만료형 콜백 토큰을 시도 ID에 묶고, `authResultCode`, `clientId`, `orderId`, 금액과 인증 `signature`를 검증한다. 기존 `bytes`의 본문 제한을 적용한다. 인증 결과의 서명은 `authToken + clientId + amount + secretKey`를 SHA-256으로 계산해 비교한다. 인증 직후 `tid`와 주문번호의 거래 조회 가능 범위는 샌드박스에서 확인한다. [인증 응답 명세](https://github.com/nicepayments/nicepay-manual/blob/main/api/payment-window-server.md#응답-명세-server-승인-모델)
- [ ] RPC에서 활성 시도와 `tid`를 잠그고, 선점한 요청만 `POST /v1/payments/{tid}`로 서버 금액을 보낸다. HTTP 응답과 `resultCode=0000`, `status=paid`, 응답 서명, `tid`, 시도 ID, 금액, 통화, `paidAt`을 대조한다. 원승인 `tid` 저장과 `complete_payment`의 주문·이용권 확정을 같은 트랜잭션으로 처리한다. [승인 명세](https://github.com/nicepayments/nicepay-manual/blob/main/api/payment-window-server.md#승인)
- [ ] 확정 후 `303`으로 기존 성공 화면에 내부 주문 ID만 전달한다. `GET /api/orders/:orderId/payment-status`는 로그인한 소유자에게 저장된 상태와 상품 유형만 반환한다. 확정 실패와 고객 취소는 기존 결과 화면을 검토해 연결한다. 결과 미확정 상태에서 이동할 화면과 문구는 승인된 기준을 받는다.
- [ ] SDK 테스트에서 상품 상세와 강의 미리보기가 같은 서버 주문 경로를 사용하고, 중복 클릭·창 닫힘·인증 실패에서 승인 중복이나 구매 잠김이 없는지 확인한다. 유효하지 않은 서명·토큰·금액, 소유자가 다른 주문의 조회, 동일 콜백 재전송을 자동 테스트한다.

## 3. 웹훅과 승인 복구 연결

**대상** `src/app/api/payments/webhook/route.ts`, `src/server/orders.ts`, `src/server/nicepay.ts`, `src/app/api/admin/orders/[orderId]/recover/route.ts`.

- [ ] 카드 승인·취소 웹훅을 기존 경로에서 받는다. 서명 검증 후 서버가 `GET /v1/payments/{tid}`로 최신 상태를 조회해 주문과 대조한다. 처리 완료와 이미 처리한 이벤트에는 HTTP `200`, `Content-Type: text/html`, 본문 `OK`를 반환한다. 일시적인 저장·조회 실패는 재전송 대상으로 남긴다. [웹훅 명세](https://github.com/nicepayments/nicepay-manual/blob/main/api/hook.md)
- [ ] 승인 응답의 읽기 시간 초과는 시도를 잠근 뒤 `POST /v1/payments/netcancel`을 호출한다. 망취소 진행 중에는 웹훅도 이용권 확정을 보류한다. 취소 확인 후에만 해당 시도를 종료한다. 승인 성공 후 DB 쓰기가 실패하면 웹훅 또는 관리자 복구가 조회 결과로 확정한다. 진행 중 승인과 복구를 직렬화한다. [망취소](https://github.com/nicepayments/nicepay-manual/blob/main/api/cancel.md#망취소), [거래 조회](https://github.com/nicepayments/nicepay-manual/blob/main/api/status-transaction.md)
- [ ] 승인 성공 후 DB 실패, 망취소 응답 유실, 웹훅 중복과 순서 역전을 주입한다. 확정 주문에는 이용권 하나가 있고, 망취소 완료 주문에는 이용권이 없어야 한다. 결과 미확정 시에는 새 승인 호출을 차단한다.

## 4. 환불 전환과 토스 코드 제거

**대상** `src/server/orders.ts`, `src/server/index.ts`, `src/app/api/payments/confirm/route.ts`, 결제창·결과 화면, `.env.example`, `tests/server.test.mjs`, `tests/auth-redirect.test.mjs`.

- [ ] 기존 자동·관리자 환불 경로를 원승인 `tid`의 `POST /v1/payments/{tid}/cancel`에 연결한다. `refunds.request_key`로 고유 취소 주문번호를 만들고 취소 호출을 한 번만 선점한다. 0원은 기존 DB 처리를 사용한다. 부분취소는 `cancelAmt`를 명시하고 잔액·부분취소 가능 여부를 확인한다. 전액취소는 원결제액과 환불액이 일치할 때 진행한다. [취소 명세](https://github.com/nicepayments/nicepay-manual/blob/main/api/cancel.md#취소환불)
- [ ] 조회로 원거래와 취소 거래, 취소 금액의 일치를 확인한 후 `complete_refund`로 이용권을 회수한다. 승인된 나이스페이 시도와 연결된 주문만 자동 취소한다. 응답 유실 또는 상점에서 직접 취소한 내역이 처리 중인 환불과 충돌하면 관리자 대사로 넘긴다. 확정 전에는 취소를 다시 호출하거나 기존 환불 기록을 덮어쓰지 않는다.
- [ ] 토스 SDK 로더, 토스 REST 호출과 응답 매핑, 기존 `/api/payments/confirm`, 브라우저의 `paymentKey` 전달, `TOSS_*` 환경 변수 예시와 토스 전용 테스트를 제거한다. 승인·환불 복구 테스트는 나이스페이 계약으로 바꾼다. 기존 작업 트리의 사용자 변경을 보존한다.
- [ ] 앱·테스트·환경 변수 예시에서 토스 연동 참조가 0건인지 검색한다. 약관·개인정보 처리방침의 수탁사 명칭은 운영에서 확정한 문구에 따라 별도로 처리한다. 과거 기록은 운영 대사에 사용한다.

## 5. 검증과 전환

- [ ] 전용 로컬 Supabase와 앱에서 `npm run test:server`를 실행한다. 이어서 `node --test tests/auth-redirect.test.mjs`, `npm run lint`, `npm run build`를 통과시킨다.
- [ ] Desktop·Mobile 웹에서 VOD와 PDF 구매, 로그인 만료, 창 닫힘, 확정 실패, 성공 후 강의실·구매 내역 진입을 확인한다. 나이스페이 샌드박스에서 승인·조회·전액취소와 웹훅 테스트 호출을 검증한다. [샌드박스 기능](https://github.com/nicepayments/nicepay-manual/blob/main/common/test.md#샌드박스를-통한-test), [웹훅 테스트](https://github.com/nicepayments/nicepay-manual/blob/main/management/admin.md#test호출)
- [ ] 공식 샌드박스는 부분취소를 지원하지 않는다. 부분취소와 취소 응답 유실은 모의 응답으로 검증한 뒤, 별도 운영 테스트 승인 시 실제 카드 부분취소까지 대조한다. 운영 공개 전 주문 금액, PG 승인·취소 금액, 이용권 상태를 비교한다. [샌드박스 제약](https://github.com/nicepayments/nicepay-manual/blob/main/common/test.md#샌드박스를-통한-test)
- [ ] 운영 상점 키와 HTTPS 웹훅을 등록한다. 기존 토스 대기 거래를 대조한 뒤 신규 결제를 전환하고 토스 런타임 설정을 정리한다. 장애 시 신규 승인을 차단할 수단을 점검한다. 차단 상태에서도 이미 승인된 나이스페이 거래의 웹훅·조회·환불·복구가 가능한지 검증한다.

## 로컬 구현 검증

- 전용 로컬 Supabase에 결제 마이그레이션을 적용했다. 서버 통합 테스트 10개, 인증·화면 테스트 43개, 타입 검사, ESLint와 프로덕션 빌드를 통과했다.
- 테스트 키로 샌드박스 API 인증을 확인했다. 데스크톱 강의 구매와 390px 웹 뷰포트의 교재 구매에서 테스트 결제창과 대기 주문을 확인했다. 실카드 인증과 실제 PG 승인·취소는 검증 대기다.
- 서명·금액 변조, 중복 승인, 망취소 응답 유실, 승인 후 DB 실패, 전액·부분취소와 취소 응답 유실은 전용 DB에 연결한 PG 모의 응답으로 검증했다.
- 승인 결과 미확정 안내와 기존 토스 실거래 환불 절차는 결정 대기다. 취소 거래번호가 확인되지 않은 처리 중 환불은 운영 대사가 필요하다.
