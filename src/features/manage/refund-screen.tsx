'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmationDialog, SiteFooter, SiteHeader } from '@/components/site';
import { useProfile } from '@/features/account';
import { useLoginRedirect } from '@/features/auth';
import { getRefund, recoverRefund, reviewRefund } from './refunds-api';
import { date, dateTime, refundErrorMessage, statusLabels, won } from './refunds-format';
import manage from './manage.module.css';
import styles from './refunds.module.css';

type Confirm = 'approve' | 'reject' | null;
const codeOf = (error: unknown) => (error as { code?: string } | null)?.code;

export function ManageRefundScreen({ orderId }: { orderId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useProfile();
  const query = useQuery({ queryKey: ['admin-refund', orderId], queryFn: () => getRefund(orderId) });
  const { requiresLogin, redirectIfUnauthorized } = useLoginRedirect(profile.error, query.error);
  const [amount, setAmount] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  if (requiresLogin) return null;

  const data = query.data;
  const header = <SiteHeader mobileAt1360 profileLoading={profile.isPending} profile={profile.data ? { name: profile.data.name, image: profile.data.avatar } : undefined} />;
  if (!data) return <>{header}<main className={manage.main}>{query.isError
    ? <><p role="alert">{refundErrorMessage(codeOf(query.error))}</p><Link href="/manage/refunds" className={manage.outlined}>목록으로</Link></>
    : <p className={styles.muted} aria-busy="true">환불 요청을 불러오는 중이에요.</p>}</main><SiteFooter /></>;

  const digits = amount ?? String(data.refundAmount);
  const approved = Number(digits);
  const blockedPdf = data.kind === 'pdf' && data.downloads > 0;
  const partialBlocked = data.payment && !data.payment.partialCancel && approved > 0 && approved < data.paidAmount && !data.external;

  async function run(task: () => Promise<string>) {
    if (operation.current) return;
    operation.current = true; setBusy(true); setMessage('');
    try {
      setResult(await task());
      await queryClient.invalidateQueries({ queryKey: ['admin-refunds'] });
    } catch (error) {
      if (!redirectIfUnauthorized(error)) setMessage(refundErrorMessage(codeOf(error)));
    } finally {
      operation.current = false; setBusy(false); setConfirm(null);
      void query.refetch();
    }
  }
  function ask(next: Exclude<Confirm, null>) {
    if (!reason.trim()) { setMessage('처리 사유를 입력해주세요.'); return; }
    if (next === 'approve' && (!/^\d+$/.test(digits) || approved > data!.paidAmount)) { setMessage(`승인 금액은 0원 ~ ${won(data!.paidAmount)} 사이로 입력해주세요.`); return; }
    setMessage(''); setConfirm(next);
  }
  const approve = () => run(async () => {
    const response = await reviewRefund(orderId, true, approved, reason.trim());
    return response.status === 'completed' ? `${won(approved)} 환불을 완료했어요.` : '승인했어요. 결제사 응답을 확인하는 중이에요.';
  });
  const reject = () => run(async () => {
    await reviewRefund(orderId, false, data.refundAmount, reason.trim());
    return '환불 요청을 거절했어요. 주문은 결제완료로 돌아갔어요.';
  });
  const recover = () => run(async () => {
    const response = await recoverRefund(orderId);
    return response.status === 'completed' ? '결제사 기록을 확인해 환불을 완료했어요.' : '결제사 기록을 확인했어요.';
  });

  const badge = data.status === 'review' || data.status === 'processing'
    ? <span className={`${styles.badge} ${styles[data.status]}`}>{statusLabels[data.status]}</span>
    : <span className={`${styles.badge} ${styles.plain}`}>{statusLabels[data.status]}</span>;
  const usedMinutes = Math.floor(data.usedSeconds / 60), totalMinutes = Math.floor(data.totalSeconds / 60);

  return <>{header}<main className={manage.main}>
    <div className={manage.heading}>
      <div className={manage.headingRow}><h1>{data.status === 'processing' ? '환불 처리 확인' : '환불 요청 확인'}</h1><div className={styles.filters}>{badge}{data.external && <span className={`${styles.badge} ${styles.plain}`}>PG 직접 취소</span>}</div></div>
      <p className={styles.muted}>{data.external ? '감지' : '신청'} {dateTime(data.requestedAt)} · {data.name || '탈퇴 회원'}{data.email && ` (${data.email})`}</p>
    </div>

    <div className={styles.sections}>
      {data.status === 'processing' && <div role="alert" className={styles.alert}><div><p className={styles.alertTitle}>결제사 응답을 받지 못했어요</p><p className={styles.muted}>{won(data.refundAmount)} 취소를 요청했지만 결과를 받지 못했어요. 실제로 취소됐는지 확인이 필요해요.</p></div></div>}
      {data.status === 'review' && data.external && <div role="note" className={styles.notice}><p className={styles.noticeTitle}>나이스페이 관리자에서 {won(data.refundAmount)}이 이미 취소됐어요</p><p className={styles.muted}>승인하면 이 금액으로 환불 완료 처리하고 수강 권한을 회수해요. 수강을 유지하려면 거절하세요.</p></div>}
      {data.status === 'review' && blockedPdf && <div role="note" className={styles.notice}><p className={styles.noticeTitle}>다운로드한 전자책이라 승인할 수 없어요</p><p className={styles.muted}>거절로 처리해주세요.</p></div>}

      <section className={styles.card}>
        <h2>주문</h2>
        <div className={styles.facts}>
          <div className={styles.fact}><span>상품명</span><span className={styles.inline}><span className={styles.tag}>{data.kind === 'vod' ? 'VOD' : '교재'}</span>{data.title}</span></div>
          <div className={styles.fact}><span>결제</span><span>{data.paidAt ? `${date(data.paidAt)} · ` : ''}{won(data.paidAmount)} · 카드</span></div>
          {data.startsAt && data.expiresAt && <div className={styles.fact}><span>{data.kind === 'vod' ? '수강 기간' : '다운로드 기간'}</span><span>{date(data.startsAt)} ~ {date(data.expiresAt)}</span></div>}
          {data.cancelStartedAt && <div className={styles.fact}><span>취소 요청</span><span>{dateTime(data.cancelStartedAt, true)}</span></div>}
        </div>
      </section>

      <section className={styles.card}>
        <h2>이용 내역</h2>
        <div className={styles.facts}>
          {data.kind === 'vod' ? <>
            <div className={styles.fact}><span>유료 영상</span><span>{usedMinutes === 0 ? '시청 안 함' : `${totalMinutes}분 중 ${usedMinutes}분 시청`} (중복·무료 미리보기 제외)</span></div>
            {data.progress !== null && <div className={styles.fact}><span>진도율</span><span>{data.progress}%</span></div>}
            <div className={styles.fact}><span>자료 다운로드</span><span>{data.downloads ? `${data.downloads}회` : '없음'}</span></div>
          </> : <div className={styles.fact}><span>다운로드</span><span>{data.downloads ? `${data.downloads}회` : '없음'}</span></div>}
        </div>
      </section>

      {data.status === 'processing' ? <section className={styles.card}>
        <h2>다시 확인하면</h2>
        <ol className={styles.steps}>
          <li>나이스페이에서 이 결제의 상태를 조회해요.</li>
          <li>이미 취소됐으면 환불 완료로 처리해요.</li>
          <li>취소되지 않았으면 취소를 다시 요청해요. 첫 요청 후 35초가 지나야 해요.</li>
        </ol>
      </section> : <section className={styles.card}>
        <h2>{data.external ? '결제사 상태' : '환불 금액'}</h2>
        <div className={styles.line}><span>결제금액</span><span>{won(data.paidAmount)}</span></div>
        {data.external
          ? <div className={styles.line}><span>나이스페이에서 취소된 금액</span><span>-{won(data.refundAmount)}</span></div>
          : <div className={styles.line}><span>이용분 공제{data.kind === 'vod' && totalMinutes ? ` (${usedMinutes}분 ÷ ${totalMinutes}분)` : ''}</span><span>-{won(data.paidAmount - data.refundAmount)}</span></div>}
        <div className={styles.divider} />
        <div className={styles.total}><span>{data.external ? '남은 결제금액' : data.status === 'review' ? '계산된 환불금액' : '환불금액'}</span><span>{won(data.external ? data.paidAmount - data.refundAmount : data.refundAmount)}</span></div>
        {!data.external && <p className={styles.help}>결제사 상태: {data.payment ? `${data.payment.partialCancel ? '부분취소 가능' : '부분취소 불가'} · ${data.payment.cancelledAmount ? `${won(data.payment.cancelledAmount)} 취소됨` : '취소 내역 없음'}` : '확인할 수 없음'}</p>}
      </section>}

      {(data.status === 'completed' || data.status === 'rejected') && data.reason && <section className={styles.card}><h2>처리 사유</h2><p>{data.reason}</p></section>}

      {data.status === 'review' && <>
        <div className={styles.field}>
          <label htmlFor="refund-amount" className={styles.label}>승인 금액{!data.external && <span className={styles.required}>*</span>}</label>
          <div className={data.external ? `${styles.input} ${styles.readOnly}` : styles.input}>
            <input id="refund-amount" type="text" inputMode="numeric" readOnly={data.external} aria-describedby="refund-amount-help" value={digits === '' ? '' : Number(digits).toLocaleString('ko-KR')} onChange={event => setAmount(event.target.value.replace(/\D/g, '').slice(0, 9))} />
            <span>원</span>
          </div>
          <p id="refund-amount-help" className={styles.help}>{data.external ? '나이스페이에서 취소된 금액으로 고정돼요. 다른 금액은 승인할 수 없어요.'
            : partialBlocked ? '이 카드는 부분취소가 안 돼요. 전액이 아니면 나이스페이 관리자에서 직접 처리해야 해요.'
            : `0원 ~ ${won(data.paidAmount)}. 0원으로 승인하면 결제 취소 없이 수강 권한만 회수돼요.`}</p>
        </div>
        <div className={styles.field}>
          <label htmlFor="refund-reason" className={styles.label}>처리 사유<span className={styles.required}>*</span></label>
          <textarea id="refund-reason" className={styles.textarea} maxLength={1000} aria-describedby="refund-reason-help" placeholder={data.external ? '예: 고객 요청으로 나이스페이에서 직접 부분 취소' : '예: 시청한 분량을 공제하고 환불'} value={reason} onChange={event => setReason(event.target.value)} />
          <p id="refund-reason-help" className={styles.help}>승인·거절 모두 필요해요. 내부 기록용이라 회원에게는 보이지 않아요.</p>
        </div>
      </>}
      {message && <p role="alert" className={manage.error}>{message}</p>}
    </div>

    <div className={manage.actions}>
      <Link href="/manage/refunds" className={manage.outlined}>목록으로</Link>
      {data.status === 'review' && <div className={manage.rightActions}>
        <button type="button" className={manage.outlined} disabled={busy} onClick={() => ask('reject')}>{data.external ? '거절 · 수강 유지' : '거절'}</button>
        <button type="button" className={manage.primary} disabled={busy || blockedPdf} onClick={() => ask('approve')}>{data.external ? `${won(data.refundAmount)}으로 완료 처리` : `${won(approved)} 승인`}</button>
      </div>}
      {data.status === 'processing' && <button type="button" className={manage.primary} disabled={busy} onClick={() => void recover()}>{busy ? '확인 중' : '다시 확인'}</button>}
    </div>
  </main>
  <SiteFooter />
  {confirm === 'approve' && <ConfirmationDialog label="환불 승인 확인" onCancel={() => setConfirm(null)} actions={[{ label: '취소', cancel: true }, { label: busy ? '처리 중' : '환불', onClick: () => void approve() }]}>
    <p>{data.name || '탈퇴 회원'} · {data.title}</p>
    <p>환불 금액: {won(approved)}</p>
    <p>{data.external ? '이미 취소된 금액으로 환불 완료 처리하고 수강 권한을 회수해요.' : approved > 0 ? '승인하면 결제가 바로 취소되고 수강 권한이 회수돼요.' : '0원 승인은 결제 취소 없이 수강 권한만 회수해요.'}</p>
  </ConfirmationDialog>}
  {confirm === 'reject' && <ConfirmationDialog label="환불 거절 확인" onCancel={() => setConfirm(null)} actions={[{ label: '취소', cancel: true }, { label: busy ? '처리 중' : '거절', onClick: () => void reject() }]}>
    <p>환불 요청을 거절할까요?</p>
    <p>주문은 결제완료로 돌아가고 계속 이용할 수 있어요.</p>
  </ConfirmationDialog>}
  {result && <ConfirmationDialog label="처리 결과" onCancel={() => setResult('')} actions={[{ label: '목록으로', primary: true, onClick: () => router.push('/manage/refunds') }]}>
    <p>{result}</p>
  </ConfirmationDialog>}
  </>;
}

