'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProfile } from '@/features/account';
import { useLoginRedirect } from '@/features/auth';
import { getCourses } from './courses-api';
import { courseEditHref, courseFilters, courseStatusLabels, courseTitle, courseViewHref, matchesCourse } from './courses-format';
import type { AdminCourse, AdminCourseFilter } from './courses-types';
import { date, refundErrorMessage, won } from './refunds-format';
import { ManageShell } from './refunds-shell';
import shared from './refunds.module.css';
import styles from './courses.module.css';

const columns = ['상품명', '판매가', '수강 기간', '영상', '판매 상태', '등록일', '관리'];

export function ManageCoursesScreen() {
  const profile = useProfile();
  const query = useQuery({ queryKey: ['admin-courses'], queryFn: getCourses });
  const { requiresLogin } = useLoginRedirect(profile.error, query.error);
  const [filter, setFilter] = useState<AdminCourseFilter>('all');
  const [search, setSearch] = useState('');
  if (requiresLogin) return null;
  const items = query.data ?? [];
  const visible = items.filter(item => matchesCourse(item, filter, search));
  const errorCode = (query.error as { code?: string } | null)?.code;
  return <ManageShell profile={profile.data} profileLoading={profile.isPending} section="courses">
    <div className={styles.headingRow}>
      <div><h1 className={shared.title}>강의 목록{query.data ? `(${items.length})` : ''}</h1><p className={shared.subtitle}>등록한 강의와 교재를 확인하고 수정하세요.</p></div>
      {errorCode !== 'forbidden' && <Link href="/manage/courses/new" className={styles.create}>강의 등록</Link>}
    </div>
    {query.isPending ? <p className={shared.muted} aria-busy="true">강의 목록을 불러오는 중이에요.</p>
      : query.isError ? <div className={shared.stack}><p role="alert">{refundErrorMessage(errorCode)}</p>{errorCode !== 'forbidden' && <div><button type="button" className={`${shared.pill} ${shared.pillView}`} onClick={() => void query.refetch()}>다시 시도</button></div>}</div>
      : <div className={shared.stack}>
        <div className={shared.toolbar}>
          <div role="group" aria-label="판매 상태로 거르기" className={shared.filters}>{courseFilters.map(option =>
            <button key={option.value} type="button" className={shared.filter} aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>{option.label} {option.value === 'all' ? items.length : items.filter(item => item.status === option.value).length}</button>)}</div>
          <input type="search" className={shared.search} aria-label="상품명으로 검색" placeholder="상품명 검색" value={search} onChange={event => setSearch(event.target.value)} />
        </div>
        {visible.length === 0 ? <p className={shared.empty}>{items.length ? '조건에 맞는 강의가 없어요.' : '아직 등록한 강의가 없어요.'}</p>
          : <div className={shared.tableScroll}><div role="table" aria-label="강의 목록" className={shared.table}>
            <div role="row" className={styles.header}>{columns.map(column => <div role="columnheader" key={column}>{column}</div>)}</div>
            <div role="rowgroup" className={shared.rows}>{visible.map((item, index) => <Fragment key={`${item.status === 'draft' ? 'draft' : 'course'}:${item.id}`}>{index > 0 && <div role="presentation" className={shared.divider} />}<CourseRow item={item} /></Fragment>)}</div>
          </div></div>}
      </div>}
  </ManageShell>;
}

function CourseRow({ item }: { item: AdminCourse }) {
  const view = courseViewHref(item), draft = item.status === 'draft';
  return <div role="row" className={styles.row}>
    <div role="cell" className={styles.product}>
      {item.image ? <Image unoptimized className={styles.thumbnail} src={item.image} width={64} height={48} alt="" /> : <span className={styles.thumbnail} aria-hidden="true" />}
      <span className={styles.name}><span className={shared.tag}>{item.kind === 'vod' ? '강의' : '교재'}</span><span title={courseTitle(item)}>{courseTitle(item)}</span></span>
    </div>
    <div role="cell" className={shared.nowrap}>{item.price === null ? '-' : won(item.price)}</div>
    <div role="cell" className={shared.nowrap}>{item.licenseDays === null ? '-' : `${item.licenseDays}일`}</div>
    <div role="cell" className={shared.nowrap}>{item.lessons ? `${item.lessons}개` : '-'}</div>
    <div role="cell">{item.status === 'stopped' ? <span className={shared.muted}>{courseStatusLabels.stopped}</span>
      : <span className={`${shared.badge} ${draft ? shared.plain : styles.selling}`}>{courseStatusLabels[item.status]}</span>}</div>
    <div role="cell" className={shared.nowrap}>{date(item.date)}</div>
    <div role="cell" className={styles.actions}>
      <Link href={courseEditHref(item)} className={`${shared.pill} ${shared.pillReview}`}>{draft ? '이어서 작성' : '수정'}</Link>
      {view && <Link href={view} className={`${shared.pill} ${shared.pillView}`}>상품 보기</Link>}
    </div>
  </div>;
}
