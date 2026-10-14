'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { SourceReview } from './landing-content';
import styles from './landing.module.css';

export function ReviewDialog({ review, onClose }: { review: SourceReview; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [loaded, setLoaded] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const originalOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.documentElement.style.overflow = originalOverflow;
      opener?.focus({ preventScroll: true });
    };
  }, []);

  function close() {
    dialogRef.current?.close();
    onClose();
  }

  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="review-dialog-title" onCancel={event => { event.preventDefault(); close(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  }} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const targets = event.currentTarget.querySelectorAll<HTMLElement>('[tabindex="0"], button');
    const first = targets[0], last = targets[targets.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <h2 id="review-dialog-title" className={styles.dialogTitle}>시청자 댓글 원문</h2>
    <div className={styles.dialogBody} tabIndex={0} aria-busy={!failed && loaded < review.images.length}>
      {failed ? <p role="alert">원문 이미지를 불러오지 못했습니다.</p> : loaded < review.images.length && <p role="status">원문 이미지를 불러오는 중입니다.</p>}
      {!failed && <div className={styles.reviewOriginal}>{review.images.map((part, index) => <Image unoptimized loading="eager" key={part.src} src={part.src} width={part.width} height={part.height} alt={index === 0 ? `${review.author} 시청자 댓글 원문 캡처` : `원문 이미지 ${index + 1}번째 부분`} onLoad={() => setLoaded(count => count + 1)} onError={() => setFailed(true)} />)}</div>}
    </div>
    <div className={styles.dialogRule}><Image unoptimized src="/assets/landing/review-rule.svg" width={440} height={1} alt="" /></div>
    <div className={styles.dialogFooter}><p className={styles.dialogNotice}>사용자가 제공한 유튜브 댓글 이미지입니다.<br />이미지 안의 계정·상대적 작성 시점은 캡처 당시 표시를 그대로 담고 있습니다.</p><button type="button" className={styles.closeButton} onClick={close}>닫기</button></div>
  </dialog>;
}
