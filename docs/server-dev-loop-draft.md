# 빠른수학 서버 구현 전용 프롬프트

2026-10-09 · 기존 프로젝트 `/Users/sangkun/nocoders/quick-math` · PC UI만 대상

## 실행 지시

기존 Next.js 16.4.0 App Router·React Compiler·Cache Components·strict TypeScript·CSS Modules 설정을 유지한다. Supabase가 연결된 환경을 전제로 아래 서버를 구현→검증→최소 수정하는 dev-loop로 진행한다. 연결이 없으면 마이그레이션과 코드를 완성하고 격리된 로컬 Supabase로 검증한다. 임의의 기존 클라우드 프로젝트를 수정하거나 운영 데이터·키를 사용하지 않는다.

기존 staged/unstaged diff와 untracked 파일을 조사하고 사용자 작업을 보존한다. 프로젝트 재생성, 새 Git 브랜치·worktree, 자동 커밋·push·배포, 별도 상태 파일·리뷰 JSON·서브에이전트·자동화는 추가하지 않는다. 현재 문서에 정책·실행 방법·검증 결과를 기록한다. 화면에 없는 디자인·문구·상태·모바일 UI를 추가하지 않는다.

## 임시 정책 v1

이 정책은 사용자가 먼저 작성하도록 위임한 개발 기준이다. 운영 약관이나 법률 적합성 확정으로 취급하지 않는다.

| 분야 | 개발 정책 |
| --- | --- |
| 인증 | 이메일·비밀번호, 최소 8자·최대 128자. 이메일 확인 후 로그인. 비밀번호는 공백을 임의로 제거하지 않음. 필수 약관 3개·선택 마케팅 동의를 기록 |
| 비밀번호 복구 | 존재 여부와 무관하게 같은 응답. 이름·연락처는 형식만 검사하고 소유권 증명으로 쓰지 않음. 이메일 링크로 검증된 세션에서 변경 |
| 권한 | 일반 사용자·관리자. 관리자 지정은 DB의 서버 전용 역할 기록으로만 가능. URL·user_metadata로 권한 부여 금지 |
| 이용권 | PG가 확인한 결제 시각부터 정확히 60×24시간, 종료 시각은 미포함. 수강실 숨김은 만료 항목만 허용하고 구매 기록 유지 |
| 환불 | VOD 예상액은 실결제액−올림(실결제액×중복 제외 유료 이용초/전체 유료초). 무료 구간 제외. 사용 이력 없는 주문은 자동 처리. 사용 이력·PDF 제공·결제 후 7일이 지난 PDF 주문은 검토 접수하고 관리자 확인 후 PG 취소. 다운로드만으로 일괄 거부하지 않음 |

환불 견적은 5분 유효, 이용분·금액 변경 시 재확인한다. 환불 준비와 진도·파일 제공을 같은 주문 잠금으로 직렬화한다. 검토·환불 처리 중 신규 콘텐츠 제공을 보류하며 반려 시 이용권을 복구한다. 실제 반환 기한·법적 예외·보관 기간은 운영 전 별도 검토가 필요하다.

금액은 원 단위 정수, DB 시각은 UTC, 표시 시각은 KST다. 유료 PDF는 private bucket에 둔다. URL 유효 기간은 최대 60초이고 이용권 만료를 넘기지 않는다. 프로필 이미지의 파일 형식·실제 디코딩·5MiB 제한을 서버에서 검증한다. 이미 발급한 URL이나 다운로드한 파일은 환불로 즉시 회수되지 않는다.

닫은 결제창의 재시도는 기존 대기 주문을 재사용한다. 결제 식별자는 새 요청으로 덮지 않는다. v1은 환불 완료 외 동일 상품의 재구매·연장 상품을 제공하지 않는다. 프로필 저장은 조회 당시 revision을 요구하며 동시 수정 시 409를 반환한다. 이전 이미지·교재 파일은 자동 삭제하지 않는다.

## 구현 범위와 순서

1. DB: 회원·역할·동의, 상품·챕터·강의·후기, 주문·이용권, 재생 세션·진도·다운로드·환불. FK·CHECK·중복 제약·인덱스·RLS·최소 GRANT 및 트랜잭션 RPC 구현.
2. 인증·프로필: 실제 Auth 가입·로그인·로그아웃·복구·콜백·비밀번호 변경, 본인 프로필 조회·저장·이미지. 입력 검증·CSRF·요청 제한·개인 캐시 분리.
3. 상품·결제: 공개 목록·상세, 관리자 관리 API, 주문 생성·Toss 승인·조회 복구·웹훅, 확인된 결제로만 이용권 발급.
4. 수강: 본인 수강실·숨김, 만료 검사, private PDF 접근, Vimeo 재생 정보·세션·순서 있는 heartbeat·중복 제외 구간 집계.
5. 환불: 본인 견적·신청, 검토 상태·관리자 승인/반려, Toss 취소 결과와 DB 복구, PC 화면과 데이터 연결.

PG·DB는 하나의 트랜잭션이 아니다. PG 호출 전 주문·환불 작업과 멱등 키를 DB에 기록한다. 같은 작업의 재시도는 같은 키를 사용한다. 타임아웃을 실패 확정으로 처리하거나 새 작업으로 덮지 않는다. 승인·취소 결과 확인 후 DB를 원자적으로 갱신하고, 저장 실패는 조회·재실행으로 복구한다. 브라우저 이벤트는 완전한 시청 증빙이 아니므로 이용 이력이 있는 자동 환불은 하지 않는다.

## 데이터 연결

기존 화면 DTO와 최소 조회 함수를 유지하며 `/__mock/...`와 `/api/...`를 환경 모드로 분리한다. 개발 기본은 MSW, 실제 검증은 MSW 비활성이다. 운영 환경에서는 MSW를 시작하지 않는다. 실제 모드 조회는 worker 준비 조건과 분리한다. 화면 상태는 React, 서버 상태는 TanStack Query, 실제 공유 UI 상태가 생기기 전에는 Zustand store를 만들지 않는다.

모든 보호 API가 요청별 검증된 사용자와 소유권을 확인한다. 비밀 키·유료 원본 경로·토큰은 공개 DTO에 포함하지 않는다. Auth 쿠키·개인 응답은 공유 캐시 금지. Auth 사용자 생성과 프로필 기록은 DB 트리거로 일치시킨다. 역할 테이블과 금융 RPC는 service_role만 접근한다. 로그아웃한 세션은 API와 개인 데이터 RLS 모두에서 차단한다. 갱신 쿠키는 요청별 Route Handler 응답에 전달하며, 현재 Server Component에는 개인 조회를 추가하지 않는다.

## 개발 루프

각 작업은 하나의 DB/API/화면 동작을 기준으로 조사→최소 구현→검증→수정한다. 실패 단위·기대와 실제·로그·원인 가설을 대화에 남기고 한 가설만 수정한다. 같은 실패 수정은 최대 3회다. 접근·환경 문제는 코드 재시도로 세지 않고 독립 작업을 계속한다.

| 검증 | 완료 근거 |
| --- | --- |
| DB | 새 로컬 DB에 마이그레이션 적용, 사용자 A/B·anon·관리자·service 역할, 소유권 변경·금융 직접 쓰기 차단, 중복·트랜잭션·환불 동시성 |
| 실제 로컬 연동 | MSW 비활성, Auth·API·DB·Storage 실제 응답 확인. 로그인·만료·저장·빈 데이터·거부·복구 |
| 외부 서비스 | Toss·Vimeo·SMTP 키 없으면 실서비스 검증 불가로 기록. 테스트용 공급자 응답 검증과 실제 PG 검증을 구분 |
| PC | 기존 라우트 직접 진입·조작, 네트워크·오류·사용자 변경 보존·스크린샷. 모바일 제외 |
| 검사 | npm run lint, npx next typegen, npx tsc --noEmit, npm run build, Node 기본 테스트와 로컬 DB 검증 |

실제 성공을 위장하지 않는다. 완료 경로 진입만으로 인증·결제 성공을 주장하지 않는다. 실패·승인 대기·검증 불가를 숨기지 않는다.

## 실행 설정과 결과

**서버 1차 구현과 격리된 로컬 Supabase 검증을 완료했다. PC 브라우저와 외부 서비스 실연동 검증은 남아 있다.** 연결된 빠른수학 클라우드 프로젝트·키를 확인하지 못했다. 조회된 별도 비활성 프로젝트와 다른 프로젝트의 Docker 스택은 변경하지 않았다.

### 실행 환경

| 항목 | 실제 값·상태 |
| --- | --- |
| 프로젝트·앱 | `/Users/sangkun/nocoders/quick-math`, `npm run dev -- --hostname 127.0.0.1`, `http://127.0.0.1:3000` |
| 로컬 Supabase | CLI 2.120.0, API `http://127.0.0.1:54331`, Postgres 54332, Mailpit `http://127.0.0.1:54334`; Auth·DB·Storage 사용 |
| 모드 | `.env.local`의 `NEXT_PUBLIC_API_MODE=real`; MSW 비활성. 운영 환경에서도 MSW 자동 활성화 없음 |
| 추가 의존성 | `@supabase/supabase-js` 2.117.3, `@supabase/ssr` 0.12.7, `server-only` 0.0.1, 기존 설치 버전과 동일한 `sharp` 0.35.5를 직접 의존성으로 선언 |
| 보존 | Next.js·React 버전, 설정·CSS·기존 fixture 유지. 새 브랜치·커밋·push·배포·모바일 변경 없음 |

키는 무시되는 `.env.local`에만 보관한다. 저장소에는 [환경변수 템플릿](/Users/sangkun/nocoders/quick-math/.env.example)만 추가했다. 현재 키는 로컬 스택에서 생성한 값이다.

| 환경변수 | 용도 |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | 요청별 Auth 클라이언트와 서버 전용 관리자 클라이언트. 비밀 키는 브라우저에 전달하지 않음 |
| `APP_ORIGIN` | 실제 앱 출처와 고정 Auth 콜백; 개발 값은 `http://127.0.0.1:3000` |
| `NEXT_PUBLIC_API_MODE` | 실제 개발 검증은 `real`; 미지정 개발 환경은 기존 MSW |
| `TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`, `ALLOW_LIVE_PAYMENTS` | 아직 미설정. 테스트 키로 먼저 검증하며 실결제는 기본 `false` |
| `VIMEO_ACCESS_TOKEN` | 아직 미설정. 실제 영상 식별자와 공급자 접근 제한 설정도 필요 |

로컬 재실행은 프로젝트 폴더에서 다음 명령을 사용한다. `start`는 현재 가동 중인 quick-math 스택을 재사용한다. 최초 검증에서는 불필요한 Studio·Realtime·Edge 서비스 등을 제외한 스택을 사용했다.

```bash
cd /Users/sangkun/nocoders/quick-math
npx --yes supabase@2.120.0 start
npx --yes supabase@2.120.0 db push --local --include-seed
npm run dev -- --hostname 127.0.0.1
```

Docker credential helper가 멈추는 이 컴퓨터에서는 검증 명령에 별도의 `DOCKER_CONFIG=/private/tmp/quick-math-docker-config`를 적용했다. 전역 Docker 설정은 변경하지 않았다. 위 명령은 개발 환경 전용이다. 실제 클라우드 전환은 대상 프로젝트·환경을 확인한 후 마이그레이션을 적용하고 키·Auth redirect URL·Storage·SMTP를 설정해야 한다. Figma 개발 seed를 운영에 자동 적용하지 않는다.

### 구현 파일과 DB

| 범위 | 위치·내용 |
| --- | --- |
| DB | [마이그레이션 폴더](/Users/sangkun/nocoders/quick-math/supabase/migrations): 7개. 회원·역할·동의·상품·챕터·강의·후기·주문·주문 강의 스냅샷·이용권·재생 세션·진도·다운로드·환불·요청 제한, 총 15개 public 테이블 모두 RLS |
| 데이터 | [개발 seed](/Users/sangkun/nocoders/quick-math/supabase/seed.sql): 기존 Figma 상품 8개·챕터 3개·강의 4개. 실제 회원·주문·결제·영상 ID·PDF 파일을 가짜로 생성하지 않음 |
| API | [서버 공개 항목](/Users/sangkun/nocoders/quick-math/src/server/index.ts), [Route Handler 폴더](/Users/sangkun/nocoders/quick-math/src/app/api): 아래 5개 묶음, route 파일 22개 |
| 클라이언트 연결 | [HTTP 모드 연결](/Users/sangkun/nocoders/quick-math/src/lib/http.ts), 기존 feature별 조회 함수·TanStack Query·폼·구매·환불·수강실 버튼. 서버 데이터용 Zustand store 추가 없음 |
| 검증 | [서버 테스트](/Users/sangkun/nocoders/quick-math/tests/server.test.mjs): Node 기본 테스트. 전용 로컬 URL만 허용하며 테스트가 생성한 회원·파일·금융 기록만 정리 |

### API 구현 결과

| 묶음 | 구현한 요청 | 실제 검증·남은 조건 |
| --- | --- | --- |
| 인증·프로필 | `POST /api/auth/{login,signup,logout,recovery,reset}`, `GET /api/auth/callback`, `GET/PATCH /api/profile`, `POST /api/profile/image` | 실제 로컬 Auth·확인 메일·복구·비밀번호 변경, 동의·본인 저장·revision 충돌·이미지·CSRF·본문 제한 검증. 운영 SMTP와 PC 조작 남음 |
| 상품·관리 | `GET /api/products`, `GET /api/products/:slug`, `POST /api/admin/products`, `PATCH /api/admin/products/:id`, `POST /api/admin/products/:id/{chapters,lessons}`, `PUT /api/admin/products/:id/file` | 공개 목록·정렬·상세, 관리자 우회 차단·private PDF 업로드 검증. 미제공 관리 화면은 새로 만들지 않음 |
| 주문·결제 | `GET/POST /api/orders`, `POST /api/payments/confirm`, `POST /api/payments/webhook`, `POST /api/admin/orders/:orderId/recover` | 소유권·금액 변조·멱등 승인·대기 주문 재시도·중복 웹훅·PG 성공 후 DB 실패 복구 검증. Toss 실 테스트 계정·공개 웹훅 수신 주소 필요 |
| 수강·파일 | `GET /api/classroom`, `GET /api/classroom/courses/:courseId`, `POST /api/classroom/:id/hide`, `POST /api/orders/:orderId/download`, `POST /api/playback`, `POST /api/playback/progress` | 본인 이용권·만료·숨김 보존·signed PDF·탐색/무료 구간 제외·중복 집계 검증. Vimeo SDK 연결 코드는 작성했으나 실제 영상 재생 미검증 |
| 환불 | `GET /api/orders/:orderId/refund-quote`, `POST /api/orders/:orderId/refund`, `POST /api/admin/refunds/:orderId` | HMAC 변조·견적 변경·동시 이용·수동 검토·반려 복구·취소 후 DB 실패·중복 취소 방지 검증. 실제 Toss 취소와 운영 환불 정책 검토 남음 |

PG 계약 테스트는 테스트 프로세스 안에서만 공급자 응답과 DB 저장 실패를 주입했다. 실제 로컬 DB에 주문·이용권 결과를 대조하고 정리했다. 실행 앱에는 성공을 반환하는 목 결제 핸들러를 추가하지 않았다. **이 검증은 실제 Toss 승인·환불 성공을 의미하지 않는다.** Toss/Vimeo 설정이 없으면 실제 API는 성공을 위장하지 않고 설정·제공 불가 오류를 반환한다.

### 검사 결과

| 검사 | 관찰 결과 |
| --- | --- |
| 새 DB 적용 | 로컬 회원·주문·Storage 객체가 0개임을 확인하고 이 작업에서 만든 전용 로컬 DB만 초기화. 마이그레이션 7개·seed 전체 재적용 성공. 기존 클라우드/다른 로컬 DB 초기화 없음 |
| 서버 테스트 | `npm run test:server`: 10개 통과, 실패 0. 사용자 A/B 분리·로그아웃한 JWT의 API와 RLS 조회 차단·실제 메일 확인·복구 링크 재사용 거부 포함. 시간 경과로 만료된 메일 토큰은 별도 미검증 |
| 카탈로그 | 실제 HTTP 조회로 개발 상품 8개, 가격 오름/내림차순, 모든 상세 응답·공개 DTO의 권한/비공개 경로 차단 확인 |
| 앱 검사 | `npm run lint`: 오류 0, 기존 생성 worker의 unused eslint-disable 경고 1. `npx next typegen`, `npx tsc --noEmit`, `npm run build` 통과 |
| 보존·키 | 전후 diff 확인, CSS·Next 설정 변경 없음. `.env.local`과 CLI 임시 파일 ignore 확인, 커밋 가능한 변경 파일에 설정된 비밀 키 없음 |

### 남은 UI·외부 연동

| 작업 단위 | 현재 단계·UI 상태 | 승인 범위·미정 사항 | 검증 근거·수정 횟수 | 다음 단계 |
| --- | --- | --- | --- | --- |
| 기존 PC 화면 전체 | 서버 연결 코드 작성 / 검증 불가 | PC만; 모바일 제외 | CUA 브라우저 정책이 localhost 접근 거부로 차단. 우회 도구·대체 브라우저 사용 없음. 새 스크린샷 없음 / 환경 문제 | 접근 허용 후 실제 라우트·입력·캐시·이동 확인 |
| 미리보기·복구 안내·로딩 | 확인 필요 | 미리보기 모달 배치, 복구/재설정 토스트 위치, 조회 로딩 표현의 기존 미정 기준 | 이번 서버 작업으로 UI 완료 처리하지 않음 / 0회 | 디자인 기준 확인 후 해당 UI 구현·검증 |
| 관리 화면 | 확인 필요 | 기존 링크의 관리 화면 디자인 미제공; 관리자 역할·API만 구현 | 새 화면 추가 없음 / 0회 | 실제 관리 UI 범위·기준 확인 |
| 클라우드·SMTP | 연동 대기 | 빠른수학 전용 개발 프로젝트·키·발신자·callback 설정 | 로컬 Auth·DB·Storage·Mailpit만 실제 검증 / 환경 문제 | 대상 확인 후 클라우드 적용·운영 메일 테스트 |
| Toss·Vimeo | 연동 대기 | 테스트 결제 키, 공개 webhook URL, 실제 영상·접근 제한·토큰 | PG 계약 테스트와 진도 RPC 검증; 실제 결제·영상 없음 / 환경 문제 | 공급자 테스트 환경에서 승인·취소·재생·접근 차단 검증 |

같은 에이전트가 구현 후 검토했다. 독립 리뷰어의 검토로 표현하지 않는다. 수정 루프에서 동의 배열 검사, 비동기 세션 확인, Next 요청 경계, 프로필 revision, 대기 주문 재시도, 로그아웃 RLS를 수정하고 해당 항목을 재검증했다. 같은 실패를 3회 이상 반복한 작업 단위는 없다.

운영 전에는 임시 환불·재구매·보관 정책을 검토하고 PG 수동 복구 담당자·모니터링을 정해야 한다. 자동 복구 작업·보관 기간을 정하지 않은 파일 자동 삭제는 추가하지 않았다. PDF 제공은 발급 이력을 기록하며, 다운로드 완료를 증명하지 않는다. 브라우저 heartbeat는 금전 처리의 완전한 시청 증빙이 아니다. 공개 서비스의 네트워크 요청 제한·대용량 업로드 한도·Vimeo 링크 재사용 제한도 배포 환경에서 확인해야 한다.

## 공식 근거

- [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage](https://supabase.com/docs/guides/storage/serving/downloads)
- [Toss 결제창](https://docs.tosspayments.com/guides/v2/payment-window/integration), [멱등 요청](https://docs.tosspayments.com/reference/using-api/authorization), [웹훅](https://docs.tosspayments.com/guides/v2/webhook)
- [Vimeo SDK](https://github.com/vimeo/player.js). Next.js는 node_modules/next/dist/docs의 설치 버전 가이드를 사용한다.
