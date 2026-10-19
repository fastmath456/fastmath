'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmationDialog } from '@/components/site';
import { RequestError } from '@/lib/http';
import { checkAccess, getEditableCourse } from './api';
import styles from './admin-course-actions.module.css';

type Action = 'edit' | 'new';
type Notice = 'forbidden' | 'not-found' | 'retry';

export function AdminCourseActions({ courseId }: { courseId: string }) {
  const router = useRouter();
  const active = useRef(false);
  const [pending, setPending] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [failedAction, setFailedAction] = useState<Action | null>(null);

  const open = async (action: Action) => {
    if (active.current) return;
    active.current = true;
    setPending(true);
    try {
      if (action === 'edit') await getEditableCourse(courseId);
      else await checkAccess();
      router.push(action === 'edit' ? `/manage/courses/${encodeURIComponent(courseId)}/edit` : '/manage/courses/new');
    } catch (error) {
      if (error instanceof RequestError && error.code === 'unauthorized') {
        setHidden(true);
        router.replace('/login');
      } else if (error instanceof RequestError && error.code === 'forbidden') {
        setHidden(true);
        setNotice('forbidden');
      } else if (action === 'edit' && error instanceof RequestError && error.code === 'not_found') {
        setNotice('not-found');
      } else {
        setFailedAction(action);
        setNotice('retry');
      }
    } finally {
      active.current = false;
      setPending(false);
    }
  };

  const closeNotice = () => setNotice(null);

  return <>
    {!hidden && <nav className={styles.actions} aria-label="관리자 작업">
      <button type="button" disabled={pending} onClick={() => void open('edit')}>해당 강의 편집하기</button>
      <button type="button" disabled={pending} onClick={() => void open('new')}>새로운 강의 등록하기</button>
    </nav>}
    {notice === 'forbidden' && <ConfirmationDialog label="관리자 권한 안내" onCancel={closeNotice} actions={[{ label: '확인', cancel: true }]}><p>관리자만 이용할 수 있습니다.</p></ConfirmationDialog>}
    {notice === 'not-found' && <ConfirmationDialog label="강의 조회 안내" onCancel={closeNotice} actions={[{ label: '강의·교재 목록', onClick: () => router.push('/courses') }]}><p>강의를 찾을 수 없습니다.</p></ConfirmationDialog>}
    {notice === 'retry' && <ConfirmationDialog label="화면 이동 오류" onCancel={closeNotice} actions={[{ label: '취소', cancel: true }, { label: '다시 시도', onClick: () => { const action = failedAction; closeNotice(); if (action) void open(action); } }]}><p>화면을 열지 못했습니다. 다시 시도해주세요.</p></ConfirmationDialog>}
  </>;
}
