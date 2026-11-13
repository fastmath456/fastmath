import type { AdminRefund, RefundFilter, RefundStatus } from './refunds-types';

export const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;
const parts = (value: string) => Object.fromEntries(new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
}).formatToParts(new Date(value)).map(part => [part.type, part.value]));
export function shortDateTime(value: string) { const p = parts(value); return `${p.month}.${p.day} ${p.hour}:${p.minute}`; }
export function dateTime(value: string, seconds = false) { const p = parts(value); return `${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute}${seconds ? ':' + p.second : ''}`; }
export function date(value: string) { const p = parts(value); return `${p.year}.${p.month}.${p.day}`; }

export function usage(item: Pick<AdminRefund, 'kind' | 'usedSeconds' | 'totalSeconds' | 'downloaded'>) {
  if (item.kind === 'pdf') return item.downloaded ? '다운로드함' : '다운로드 안 함';
  const used = Math.floor(item.usedSeconds / 60);
  return used === 0 ? '시청 안 함' : `${Math.floor(item.totalSeconds / 60)}분 중 ${used}분`;
}

export const statusLabels: Record<RefundStatus, string> = { review: '확인 필요', processing: '응답 확인 필요', completed: '환불완료', rejected: '환불 거절' };
export const filters: { value: RefundFilter; label: string }[] = [
  { value: 'all', label: '전체' }, { value: 'review', label: '확인 필요' }, { value: 'processing', label: '처리 중' },
  { value: 'completed', label: '완료' }, { value: 'rejected', label: '거절' },
];
export function matches(item: AdminRefund, filter: RefundFilter, search: string) {
  if (filter !== 'all' && item.status !== filter) return false;
  const query = search.trim().toLowerCase();
  return !query || [item.name, item.email, item.orderId, item.title].some(value => value.toLowerCase().includes(query));
}

const messages: Record<string, string> = {
  refund_mismatch: '나이스페이에서 취소된 금액과 승인 금액이 달라요. 금액을 확인해주세요.',
  refund_conflict: '이미 처리됐거나 상태가 바뀐 건이에요. 새로고침 후 다시 확인해주세요.',
  refund_downloaded: '다운로드한 전자책은 환불을 승인할 수 없어요.',
  refund_requires_review: '결제사 상태가 자동 취소 조건과 맞지 않아요. 나이스페이 관리자에서 직접 처리해주세요.',
  payment_outcome_unknown: '결제사 응답을 아직 확인할 수 없어요. 잠시 후 다시 확인해주세요.',
  payment_not_confirmed: '결제사 결제 정보를 찾을 수 없어요. 나이스페이 관리자에서 확인해주세요.',
  live_payments_disabled: '실결제 취소가 꺼져 있어요. 서버 설정(ALLOW_LIVE_PAYMENTS)을 확인해주세요.',
  forbidden: '관리자만 이용할 수 있습니다.',
  not_found: '환불 요청을 찾을 수 없어요.',
};
export const refundErrorMessage = (code: string | undefined) => (code && Object.hasOwn(messages, code) ? messages[code] : '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
