'use client';

import { Fragment, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ResetOnLeave } from '@/components/site';
import { useProfile } from '@/features/account';
import { useLoginRedirect } from '@/features/auth';
import { readResponse } from '@/lib/http';
import { ReviewEditorDialog } from '../landing/review-editor-dialog';
import { ReviewImage } from '../landing/review-image';
import type { SourceReview } from '../landing/reviews';
import { refundErrorMessage } from './refunds-format';
import { ManageShell } from './refunds-shell';
import shared from './refunds.module.css';
import courses from './courses.module.css';
import styles from './reviews.module.css';

type Reviews = { items: SourceReview[]; admin: boolean };
const columns = ['순서', '작성자', '본문', '원문 이미지', '관리'];

/** Admin page for the landing page's reviews: the same editor the landing page opens, reached from the admin menu. */
export function ManageReviewsScreen() {
  const profile = useProfile();
  const client = useQueryClient();
  const query = useQuery<Reviews>({ queryKey: ['landing-reviews'], queryFn: async () => readResponse(await fetch('/api/landing/reviews', { credentials: 'same-origin' })) });
  const { requiresLogin } = useLoginRedirect(profile.error, query.error);
  // undefined: closed, null: adding a review, a review: editing it.
  const [editing, setEditing] = useState<SourceReview | null | undefined>(undefined);
  if (requiresLogin) return null;
  const items = query.data?.items ?? [];
  const admin = query.data?.admin === true;
  return <ManageShell profile={profile.data} profileLoading={profile.isPending} section="reviews">
    <div className={courses.headingRow}>
      <div><h1 className={shared.title}>리뷰 관리{admin ? `(${items.length})` : ''}</h1><p className={shared.subtitle}>홈 화면에 보이는 유튜브 시청자 리뷰를 추가하고 수정하세요.</p></div>
      {admin && <button type="button" className={courses.create} onClick={() => setEditing(null)}>리뷰 추가</button>}
    </div>
    {query.isPending ? <p className={shared.muted} aria-busy="true">리뷰를 불러오는 중이에요.</p>
      : query.isError ? <div className={shared.stack}><p role="alert">{refundErrorMessage(undefined)}</p><div><button type="button" className={`${shared.pill} ${shared.pillView}`} onClick={() => void query.refetch()}>다시 시도</button></div></div>
      : !admin ? <p role="alert">{refundErrorMessage('forbidden')}</p>
      : items.length === 0 ? <p className={shared.empty}>아직 등록한 리뷰가 없어요.</p>
      : <div className={shared.tableScroll}><div role="table" aria-label="랜딩 리뷰" className={shared.table}>
        <div role="row" className={styles.header}>{columns.map(column => <div role="columnheader" key={column}>{column}</div>)}</div>
        <div role="rowgroup" className={shared.rows}>{items.map((item, index) => <Fragment key={item.id}>{index > 0 && <div role="presentation" className={shared.divider} />}
          <div role="row" className={styles.row}>
            <div role="cell">{index + 1}</div>
            <div role="cell" className={styles.author} title={item.author}>{item.author}</div>
            <div role="cell"><p className={styles.text}>{item.text}</p></div>
            <div role="cell"><div className={styles.image}><ReviewImage part={item.images[0]} alt={`${item.author} 원문 이미지`} /></div></div>
            <div role="cell"><button type="button" className={`${shared.pill} ${shared.pillReview}`} onClick={() => setEditing(item)}>수정</button></div>
          </div>
        </Fragment>)}</div>
      </div></div>}
    {editing !== undefined && admin && <ResetOnLeave><ReviewEditorDialog reviews={items} initial={editing} onClose={() => setEditing(undefined)} onSaved={saved => {
      client.setQueryData<Reviews>(['landing-reviews'], current => {
        const list = current?.items ?? items;
        return { admin: true, items: list.some(item => item.id === saved.id) ? list.map(item => item.id === saved.id ? saved : item) : [...list, saved] };
      });
      setEditing(undefined);
    }} /></ResetOnLeave>}
  </ManageShell>;
}
