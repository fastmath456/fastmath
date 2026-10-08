import type { Order, RefundQuote } from '@/features/account';

export const orders: Order[] = [
  {
    "id": "order-1",
    "title": "지수함수와 로그함수 핵심 정리",
    "kind": "vod",
    "status": "결제완료",
    "amount": 99000,
    "endDate": "2026. 12. 05",
    "progress": "2/34",
    "paidDate": "2026. 10. 06",
    "refundLabel": "환불",
    "refundable": true
  },
  {
    "id": "order-2",
    "title": "삼각함수 개념부터 실전까지",
    "kind": "vod",
    "status": "결제완료",
    "amount": 89000,
    "endDate": "2026. 12. 04",
    "progress": "0/28",
    "paidDate": "2026. 10. 05",
    "refundLabel": "환불",
    "refundable": true
  },
  {
    "id": "order-3",
    "title": "수열의 규칙과 합 집중 완성",
    "kind": "vod",
    "status": "결제완료",
    "amount": 79000,
    "endDate": "2026. 12. 03",
    "progress": "0/24",
    "paidDate": "2026. 10. 04",
    "refundLabel": "환불",
    "refundable": true
  },
  {
    "id": "order-4",
    "title": "미분 개념과 그래프 해석",
    "kind": "vod",
    "status": "결제완료",
    "amount": 119000,
    "endDate": "2026. 12. 02",
    "progress": "0/36",
    "paidDate": "2026. 10. 03",
    "refundLabel": "환불",
    "refundable": true
  },
  {
    "id": "order-5",
    "title": "적분의 기본과 넓이 문제 풀이",
    "kind": "vod",
    "status": "결제완료",
    "amount": 119000,
    "endDate": "2026. 12. 01",
    "progress": "0/32",
    "paidDate": "2026. 10. 02",
    "refundLabel": "환불",
    "refundable": true
  },
  {
    "id": "order-6",
    "title": "확률과 경우의 수 핵심 유형",
    "kind": "vod",
    "status": "결제완료",
    "amount": 89000,
    "endDate": "2026. 11. 30",
    "progress": "0/26",
    "paidDate": "2026. 10. 01",
    "refundLabel": "환불",
    "refundable": true
  },
  {
    "id": "order-7",
    "title": "통계 개념과 자료 해석",
    "kind": "vod",
    "status": "결제완료",
    "amount": 69000,
    "endDate": "2026. 11. 28",
    "progress": "0/20",
    "paidDate": "2026. 09. 29",
    "refundLabel": "환불",
    "refundable": true
  },
  {
    "id": "order-8",
    "title": "도형의 방정식 기초 다지기",
    "kind": "vod",
    "status": "결제완료",
    "amount": 79000,
    "endDate": "2026. 11. 26",
    "progress": "0/22",
    "paidDate": "2026. 09. 27",
    "refundLabel": "환불",
    "refundable": true
  },
  {
    "id": "order-9",
    "title": "함수의 기초와 그래프 읽기",
    "kind": "vod",
    "status": "결제완료",
    "amount": 59000,
    "endDate": "2026. 11. 24",
    "progress": "0/18",
    "paidDate": "2026. 09. 25",
    "refundLabel": "환불",
    "refundable": true
  },
  {
    "id": "order-10",
    "title": "방정식과 부등식 유형 정리",
    "kind": "vod",
    "status": "결제완료",
    "amount": 69000,
    "endDate": "2026. 11. 21",
    "progress": "0/21",
    "paidDate": "2026. 09. 22",
    "refundLabel": "환불",
    "refundable": true
  }
];
export const refundQuote: RefundQuote = { orderId: 'order-1', title: '지수함수와 로그함수 핵심 정리', text: '예상 환불 금액 89,100원\n\n실제 결제금액: 99,000원\n전체 유료 영상: 600분\n중복 제외 시청·저장: 60분 (10%)\n이용분 공제액: 9,900원\n\n무료 미리보기는 이용분에서 제외하며, 정가 차액·위약금·결제 수수료는 추가 공제하지 않습니다.\n\n환불을 신청하시겠어요?' };
