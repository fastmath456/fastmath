'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ConfirmationDialog, FormField } from '@/components/site';
import { mutate } from '@/lib/http';
import { ReviewImage } from './review-image';
import type { SourceReview } from './reviews';
import uploadStyles from '../manage/basic-information.module.css';
import styles from './review-editor-dialog.module.css';

const maxReviewImageBytes = 20 * 1024 * 1024;
const maxReviewImagePixels = 40_000_000;
const missingReviewImage = '원문 이미지를 선택해주세요.';
const oversizedReviewImage = '원문 이미지는 40,000,000픽셀 이하로 선택해주세요.';

export async function reviewImageError(file: File) {
  if (file.size === 0) return '비어 있지 않은 이미지를 선택해주세요.';
  if (file.size > maxReviewImageBytes) return '원문 이미지는 20MB 이하로 선택해주세요.';

  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file);
      const oversized = bitmap.width * bitmap.height > maxReviewImagePixels;
      bitmap.close();
      return oversized ? oversizedReviewImage : null;
    }
    return await new Promise<string | null>((resolve, reject) => {
      const image = new window.Image();
      const url = URL.createObjectURL(file);
      const cleanup = () => {
        URL.revokeObjectURL(url);
      };
      image.onload = () => {
        cleanup();
        resolve(image.naturalWidth * image.naturalHeight > maxReviewImagePixels ? oversizedReviewImage : null);
      };
      image.onerror = () => { cleanup(); reject(new Error('unreadable_image')); };
      image.src = url;
    });
  } catch {
    return '이미지를 불러오지 못했습니다. 다른 파일을 선택해주세요.';
  }
}

export function ReviewEditorDialog({ reviews, onClose, onSaved }: { reviews: SourceReview[]; onClose: () => void; onSaved: (review: SourceReview) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const saving = useRef(false);
  const imageSelection = useRef(0);
  const imageCheck = useRef<Promise<void>>(Promise.resolve());
  const imageRef = useRef<{ file: File; url: string } | null>(null);
  const imageErrorRef = useRef<string | null>(null);
  const [selected, setSelected] = useState<SourceReview | null>(reviews[0] ?? null);
  const [author, setAuthor] = useState(selected?.author ?? '');
  const [text, setText] = useState(selected?.text ?? '');
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [discard, setDiscard] = useState<(() => void) | null>(null);
  const dirty = author !== (selected?.author ?? '') || text !== (selected?.text ?? '') || image !== null;

  function replaceImage(next: { file: File; url: string } | null) {
    if (imageRef.current && imageRef.current !== next) URL.revokeObjectURL(imageRef.current.url);
    imageRef.current = next;
    setImage(next);
  }

  function reportImageError(message: string | null) {
    imageErrorRef.current = message;
    setImageError(message);
  }

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current;
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    element?.showModal();
    return () => { element?.close(); document.documentElement.style.overflow = overflow; opener?.focus({ preventScroll: true }); };
  }, []);

  useEffect(() => () => {
    imageSelection.current += 1;
    if (imageRef.current) URL.revokeObjectURL(imageRef.current.url);
  }, []);

  function move(action: () => void) {
    if (saving.current) return;
    if (dirty) setDiscard(() => action);
    else action();
  }

  function select(item: SourceReview | null) {
    move(() => {
      imageSelection.current += 1;
      imageCheck.current = Promise.resolve();
      setSelected(item); setAuthor(item?.author ?? ''); setText(item?.text ?? ''); replaceImage(null); reportImageError(null); setFailed(false);
      if (imageInput.current) imageInput.current.value = '';
    });
  }

  function chooseImage(file: File | undefined) {
    if (!file || saving.current) return;
    const selection = ++imageSelection.current;
    const check = async () => {
      const error = await reviewImageError(file);
      if (selection !== imageSelection.current) return;
      if (error) {
        reportImageError(error);
        return;
      }
      replaceImage({ file, url: URL.createObjectURL(file) });
      reportImageError(null);
    };
    imageCheck.current = check();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true; setPending(true); setFailed(false);
    try {
      await imageCheck.current;
      const selectedImage = imageRef.current;
      if (imageErrorRef.current || (!selectedImage && !selected)) {
        if (!selectedImage && !selected && !imageErrorRef.current) reportImageError(missingReviewImage);
        return;
      }
      if (!author.trim() || !text.trim()) throw new Error('invalid_review');
      const data = new FormData();
      data.set('author', author); data.set('text', text);
      if (selectedImage) data.set('image', selectedImage.file);
      const result = await mutate<{ review: SourceReview }>(`admin/landing/reviews${selected ? '/' + encodeURIComponent(selected.id) : ''}`, data, selected ? 'PATCH' : 'POST');
      onSaved(result.review);
    } catch { setFailed(true); }
    finally { saving.current = false; setPending(false); }
  }

  return <>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="review-editor-title" onCancel={event => { event.preventDefault(); move(onClose); }} onKeyDown={event => {
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
              <input ref={imageInput} id="review-image" className={uploadStyles.fileInput} type="file" required={!selected} onInvalid={event => { event.preventDefault(); reportImageError(missingReviewImage); }} onChange={event => {
                const file = event.target.files?.[0];
                chooseImage(file);
              }} />
              <button type="button" className={uploadStyles.assetUpload} onClick={() => imageInput.current?.click()} aria-label={`원문 이미지 ${image || selected ? '교체' : '업로드'}`}>
                {image ? <Image unoptimized className={uploadStyles.assetPreview} src={image.url} width={144} height={144} alt="원문 이미지 미리보기" /> : selected ? <ReviewImage part={selected.images[0]} alt="원문 이미지 미리보기" /> : <span className={uploadStyles.uploadPrompt}><span className={uploadStyles.imageIcon}><Image unoptimized src="/assets/manage-image-upload.svg" width={20} height={20} alt="" /></span><span>이미지 업로드</span></span>}
              </button>
              {imageError && <p className={uploadStyles.message} role="alert">{imageError}</p>}
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
