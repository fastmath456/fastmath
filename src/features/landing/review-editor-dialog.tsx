'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ConfirmationDialog, FormField } from '@/components/site';
import { mutate } from '@/lib/http';
import { ReviewImage } from './review-image';
import type { SourceReview } from './reviews';
import uploadStyles from '../manage/basic-information.module.css';
import styles from './review-editor-dialog.module.css';

export function ReviewEditorDialog({ reviews, onClose, onSaved }: { reviews: SourceReview[]; onClose: () => void; onSaved: (review: SourceReview) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const saving = useRef(false);
  const [selected, setSelected] = useState<SourceReview | null>(reviews[0] ?? null);
  const [author, setAuthor] = useState(selected?.author ?? '');
  const [text, setText] = useState(selected?.text ?? '');
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [discard, setDiscard] = useState<(() => void) | null>(null);
  const dirty = author !== (selected?.author ?? '') || text !== (selected?.text ?? '') || image !== null;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current;
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    element?.showModal();
    return () => { element?.close(); document.documentElement.style.overflow = overflow; opener?.focus({ preventScroll: true }); };
  }, []);

  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url); }, [image]);

  function move(action: () => void) {
    if (saving.current) return;
    if (dirty) setDiscard(() => action);
    else action();
  }

  function select(item: SourceReview | null) {
    move(() => {
      setSelected(item); setAuthor(item?.author ?? ''); setText(item?.text ?? ''); setImage(null); setFailed(false);
      if (imageInput.current) imageInput.current.value = '';
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true; setPending(true); setFailed(false);
    try {
      if (!author.trim() || !text.trim() || (image && image.file.size > 20 * 1024 * 1024) || (!image && !selected)) throw new Error('invalid_review');
      const data = new FormData();
      data.set('author', author); data.set('text', text);
      if (image) data.set('image', image.file);
      const result = await mutate<{ review: SourceReview }>(`admin/landing/reviews${selected ? '/' + encodeURIComponent(selected.id) : ''}`, data, selected ? 'PATCH' : 'POST');
      onSaved(result.review);
    } catch { setFailed(true); }
    finally { saving.current = false; setPending(false); }
  }

  return <>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="review-editor-title" onCancel={event => { event.preventDefault(); move(onClose); }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) move(onClose);
    }} onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <h2 id="review-editor-title" className={styles.title}>리뷰 관리</h2>
      <form className={styles.form} onSubmit={save} aria-busy={pending}>
        <fieldset disabled={pending} className={styles.body}>
          <div className={styles.sidebar}>
            <button type="button" className={styles.add} onClick={() => select(null)}>리뷰 추가</button>
            <div className={styles.list}>{reviews.map(item => <button key={item.id} type="button" aria-current={selected?.id === item.id ? 'true' : undefined} onClick={() => { if (selected?.id !== item.id) select(item); }}>{item.author}</button>)}</div>
          </div>
          <div className={styles.mobileSelection}>
            <select aria-label="리뷰 선택" value={selected?.id ?? ''} onChange={event => select(reviews.find(item => item.id === event.target.value) ?? null)}>
              {!selected && <option value="">리뷰 추가</option>}{reviews.map(item => <option key={item.id} value={item.id}>{item.author}</option>)}
            </select>
            <button type="button" className={styles.add} onClick={() => select(null)}>리뷰 추가</button>
          </div>
          <div className={styles.fields}>
            <FormField id="review-author" label="작성자" required maxLength={300} value={author} onChange={event => setAuthor(event.target.value)} />
            <div className={styles.field}><label htmlFor="review-text">본문</label><textarea id="review-text" required maxLength={300} value={text} onChange={event => setText(event.target.value)} /></div>
            <div className={uploadStyles.field}>
              <label htmlFor="review-image">원문 이미지</label>
              <input ref={imageInput} id="review-image" className={uploadStyles.fileInput} type="file" required={!selected} onChange={event => {
                const file = event.target.files?.[0];
                if (file) setImage({ file, url: URL.createObjectURL(file) });
              }} />
              <button type="button" className={uploadStyles.assetUpload} onClick={() => imageInput.current?.click()} aria-label={`원문 이미지 ${image || selected ? '교체' : '업로드'}`}>
                {image ? <Image unoptimized className={uploadStyles.assetPreview} src={image.url} width={144} height={144} alt="원문 이미지 미리보기" /> : selected ? <ReviewImage part={selected.images[0]} alt="원문 이미지 미리보기" /> : <span className={uploadStyles.uploadPrompt}><span className={uploadStyles.imageIcon}><Image unoptimized src="/assets/manage-image-upload.svg" width={20} height={20} alt="" /></span><span>이미지 업로드</span></span>}
              </button>
            </div>
          </div>
        </fieldset>
        {failed && <p className={uploadStyles.message} role="alert">리뷰를 저장하지 못했습니다. 다시 시도해주세요.</p>}
        <div className={styles.footer}><button type="button" className={styles.cancel} disabled={pending} onClick={() => move(onClose)}>닫기</button><button type="submit" className={styles.save} disabled={pending}>저장</button></div>
      </form>
    </dialog>
    {discard && <ConfirmationDialog label="수정한 내용을 저장하지 않고 이동할까요?" onCancel={() => setDiscard(null)} actions={[{ label: '취소', cancel: true }, { label: '확인', onClick: () => { setDiscard(null); discard(); } }]}><p>수정한 내용을 저장하지 않고 이동할까요?</p></ConfirmationDialog>}
  </>;
}
