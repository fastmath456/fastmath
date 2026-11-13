'use client';

import Image from 'next/image';
import { useId, useRef, type ChangeEvent, type ReactNode } from 'react';
import type { AssetSlot, BasicErrors, CourseAsset, CourseBasic, CourseReview } from './types';
import { formattedPrice } from './validation';
import styles from './basic-information.module.css';

type BasicInformationProps = {
  basic: CourseBasic;
  errors: BasicErrors;
  uploading: Partial<Record<AssetSlot, boolean>>;
  uploadErrors: Partial<Record<AssetSlot, string>>;
  onChange: (field: 'title' | 'basePrice' | 'price' | 'licenseDays' | 'displayOrder', value: string) => void;
  onBlur: (field: 'title' | 'basePrice' | 'price' | 'licenseDays' | 'displayOrder') => void;
  onUpload: (slot: AssetSlot, files: File[]) => void;
  onRemoveThumbnail: () => void;
  onChooseOrder: () => void;
  onRemoveMaterial: (id: string) => void;
  onRetryMaterial: (id: string) => void;
  onRemoveDetailImage: (id: string) => void;
  onRetryDetailImage: (id: string) => void;
  onReviewChange: (id: string, field: 'rating' | 'body' | 'author', value: string | number) => void;
  onReviewBlur: (review: CourseReview) => void;
  onAddReview: () => void;
  onRemoveReview: (review: CourseReview) => void;
};

type TextField = 'title' | 'basePrice' | 'price';

const fieldDetails: Record<TextField, { label: string; placeholder: string; inputMode?: 'numeric' }> = {
  title: { label: '클래스명', placeholder: '클래스명을 입력해주세요.' },
  basePrice: { label: '원가(단위: 원)', placeholder: '강의 원가를 입력해주세요.', inputMode: 'numeric' },
  price: { label: '할인가(단위: 원)', placeholder: '강의 할인가를 입력해주세요.', inputMode: 'numeric' },
};

function messageFor(slot: AssetSlot, errors: BasicErrors, uploadErrors: BasicInformationProps['uploadErrors']) {
  return uploadErrors[slot] ?? errors[slot === 'material' ? 'materials' : slot === 'detailImage' ? 'detailImages' : slot];
}

function AssetUpload({ asset, helper, label, message, slot, uploading, onUpload, onRemove, children }: {
  asset: CourseAsset | null;
  helper?: string;
  label: string;
  message?: string;
  slot: Extract<AssetSlot, 'thumbnail' | 'detailImage'>;
  uploading: boolean;
  onUpload: BasicInformationProps['onUpload'];
  onRemove?: () => void;
  children?: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  function select(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length > 0) onUpload(slot, files);
  }

  const uploadBox = <div className={styles.imageFrame}>
      <button id={`course-${slot}`} type="button" className={`${styles.assetUpload} ${asset ? styles.filledUpload : ''}`} onClick={() => input.current?.click()} aria-label={`${label} ${asset ? '교체' : '업로드'}`} disabled={slot === 'thumbnail' && uploading}>
        {asset ? <Image unoptimized className={styles.filledPreview} src={asset.url} width={164} height={164} alt={`${label} 미리보기`} /> : <span className={styles.uploadPrompt}><span className={styles.imageIcon}><Image unoptimized src="/assets/manage-image-upload.svg" width={20} height={20} alt="" /></span><span>이미지 업로드</span></span>}
      </button>
      {asset && onRemove && <button type="button" className={styles.removeImage} aria-label={`${label} 삭제`} disabled={uploading} onClick={onRemove}><Image unoptimized src="/assets/profile-imgX03.svg" width={16} height={16} alt="" /></button>}
    </div>;

  return <div className={styles.field}>
    <div className={styles.assetHeading}><label htmlFor={inputId} className={styles.label}>{label}<span aria-hidden="true" className={styles.required}>*</span></label>{helper && <p className={styles.helper}>{helper}</p>}</div>
    <input ref={input} id={inputId} className={styles.fileInput} type="file" accept=".jpg,.jpeg,.png,.webp" multiple={slot === 'detailImage'} onChange={select} />
    {slot === 'detailImage' ? <ul className={styles.detailImages} aria-label="첨부된 상세이미지"><li className={styles.imageFrame}>{uploadBox}</li>{children}</ul> : uploadBox}
    {uploading && <p className={styles.status} role="status">업로드 중...</p>}
    {message && <p className={styles.message} role="alert">{message}</p>}
  </div>;
}

export function BasicInformation({ basic, errors, uploading, uploadErrors, onChange, onBlur, onUpload, onChooseOrder, onRemoveThumbnail, onRemoveMaterial, onRetryMaterial, onRemoveDetailImage, onRetryDetailImage, onReviewChange, onReviewBlur, onAddReview, onRemoveReview }: BasicInformationProps) {
  const materialInput = useRef<HTMLInputElement>(null);
  const materialId = useId();

  function selectMaterials(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length > 0) onUpload('material', files);
  }

  function textField(field: TextField) {
      const detail = fieldDetails[field];
      const id = `course-${field}`;
      return <div className={styles.field} key={field}>
        <label htmlFor={id} className={styles.label}>{detail.label}<span aria-hidden="true" className={styles.required}>*</span></label>
        <input id={id} className={styles.input} value={field === 'title' ? basic[field] : formattedPrice(basic[field])} placeholder={detail.placeholder} inputMode={detail.inputMode} aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? `${id}-message` : undefined} onChange={event => onChange(field, event.target.value)} onBlur={() => onBlur(field)} />
        {errors[field] && <p id={`${id}-message`} className={styles.message} role="alert">{errors[field]}</p>}
      </div>;
  }

  return <div className={styles.content}>
    <AssetUpload asset={basic.thumbnail} label="클래스 대표이미지" message={messageFor('thumbnail', errors, uploadErrors)} slot="thumbnail" uploading={Boolean(uploading.thumbnail)} onUpload={onUpload} onRemove={onRemoveThumbnail} />
    <AssetUpload asset={null} helper="* 높이 3000px 이하의 사이즈를 권장합니다." label="클래스 상세이미지" message={messageFor('detailImage', errors, uploadErrors)} slot="detailImage" uploading={Boolean(uploading.detailImage)} onUpload={onUpload}>
    {basic.detailImages.map(asset => <li key={asset.id} className={styles.detailImage}>
      <div className={styles.imageFrame}>
        {asset.url && <Image unoptimized className={styles.filledPreview} src={asset.url} width={164} height={164} alt={asset.name} />}
        <button type="button" className={styles.removeImage} aria-label={`${asset.name} 삭제`} onClick={() => onRemoveDetailImage(asset.id)}><Image unoptimized src="/assets/profile-imgX03.svg" width={16} height={16} alt="" /></button>
        <span className={styles.assetName}>{asset.name}</span>
      </div>
      {asset.status === 'error' && <button type="button" onClick={() => onRetryDetailImage(asset.id)}>재시도</button>}
      {asset.status === 'uploading' && <p className={styles.status} role="status">업로드 중</p>}
      {asset.status === 'error' && <p className={styles.message} role="alert">{asset.error}</p>}
    </li>)}
    </AssetUpload>
    {textField('title')}
    <div className={styles.field}>
      <label htmlFor={materialId} className={styles.label}>교재파일</label>
      <input ref={materialInput} id={materialId} className={styles.fileInput} type="file" accept=".pdf" multiple onChange={selectMaterials} />
      <button id="course-materials" type="button" className={styles.materialUpload} onClick={() => materialInput.current?.click()}>
        <span>교재파일을 업로드해주세요.</span><Image unoptimized src="/assets/manage-upload.svg" width={24} height={24} alt="" />
      </button>
      {messageFor('material', errors, uploadErrors) && <p className={styles.message} role="alert">{messageFor('material', errors, uploadErrors)}</p>}
      {basic.materials.length > 0 && <ul className={styles.materials} aria-label="첨부된 교재파일">{basic.materials.map(material => <li key={material.id} className={styles.material}><div className={styles.materialMain}><span>{material.name}</span><div className={styles.materialActions}>{material.status === 'error' && <button type="button" onClick={() => onRetryMaterial(material.id)}>재시도</button>}<button type="button" onClick={() => onRemoveMaterial(material.id)}>삭제</button></div></div>{material.status === 'uploading' && <p className={styles.status} role="status">업로드 중</p>}{material.status === 'error' && <><p className={styles.materialStatus} role="alert">업로드 실패</p>{material.error && <p className={styles.message} role="alert">{material.error}</p>}</>}</li>)}</ul>}
    </div>
    {textField('basePrice')}
    {textField('price')}
    <div className={styles.field}>
      <label htmlFor="course-license-days" className={styles.label}>수강 가능 기간</label>
      <p className={styles.helper}>미입력 시 60일</p>
      <div className={styles.periodField}>
        <span>수강 신청일로부터</span><input id="course-license-days" value={basic.licenseDays} placeholder="수강 가능 기간을 입력해주세요." inputMode="numeric" aria-invalid={Boolean(errors.licenseDays)} aria-describedby={errors.licenseDays ? 'course-license-days-message' : undefined} onChange={event => onChange('licenseDays', event.target.value)} onBlur={() => onBlur('licenseDays')} /><span>일</span>
      </div>
      {errors.licenseDays && <p id="course-license-days-message" className={styles.message} role="alert">{errors.licenseDays}</p>}
    </div>
    <div className={styles.field}>
      <label htmlFor="course-displayOrder" className={styles.label}>정렬 순서<span aria-hidden="true" className={styles.required}>*</span></label>
      <button id="course-displayOrder" type="button" className={`${styles.input} ${styles.orderInput}`} aria-haspopup="dialog" aria-describedby={errors.displayOrder ? 'course-displayOrder-error' : undefined} onClick={onChooseOrder}>설정하기</button>
      {errors.displayOrder && <p id="course-displayOrder-error" className={styles.message} role="alert">{errors.displayOrder}</p>}
    </div>
    <div className={styles.field}>
      <h2 className={styles.label}>후기 등록</h2>
      <div className={styles.reviewList} data-guide="course-reviews">{basic.reviews.map(review => {
        const reviewErrors = errors.reviews?.[review.id] ?? {};
        const prefix = `review-${review.id}`;
        return <div className={styles.review} key={review.id}>
          <p className={styles.helper}>학생한테 받은 후기를 작성해주세요</p>
          <div className={styles.rating} role="radiogroup" aria-label="학생이 남긴 별점" aria-invalid={Boolean(reviewErrors.rating)} aria-describedby={reviewErrors.rating ? `${prefix}-rating-error` : undefined}>
            {[1, 2, 3, 4, 5].map(rating => <button type="button" key={rating} id={rating === 1 ? `${prefix}-rating` : `${prefix}-rating-${rating}`} role="radio" aria-label={`${rating}점`} aria-checked={review.rating === rating} tabIndex={review.rating === rating || (review.rating === null && rating === 1) ? 0 : -1} onClick={() => onReviewChange(review.id, 'rating', rating)} onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
              event.preventDefault(); const next = ((rating - 1 + (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : 4)) % 5) + 1;
              onReviewChange(review.id, 'rating', next);
              window.document.getElementById(next === 1 ? `${prefix}-rating` : `${prefix}-rating-${next}`)?.focus();
            }}><Image unoptimized src={rating <= (review.rating ?? 0) ? '/assets/manage-star-selected.svg' : '/assets/manage-star-empty.svg'} width={32} height={32} alt="" /></button>)}
          </div>
          {reviewErrors.rating && <p id={`${prefix}-rating-error`} className={styles.message} role="alert">{reviewErrors.rating}</p>}
          <textarea id={`${prefix}-body`} className={`${styles.input} ${styles.reviewBody}`} aria-label="후기 내용" aria-invalid={Boolean(reviewErrors.body)} aria-describedby={`${prefix}-body-help`} placeholder="후기를 입력해주세요." value={review.body} onChange={event => onReviewChange(review.id, 'body', event.target.value)} onBlur={() => onReviewBlur(review)} />
          <p id={`${prefix}-body-help`} className={reviewErrors.body ? styles.message : styles.helper}>{reviewErrors.body || `${Array.from(review.body).length.toLocaleString()} / 5,000자`}</p>
          <input id={`${prefix}-author`} className={styles.input} aria-label="후기를 남겨준 학생 이름" aria-invalid={Boolean(reviewErrors.author)} aria-describedby={reviewErrors.author ? `${prefix}-author-error` : undefined} placeholder="후기를 남겨준 학생 이름을 입력해주세요." value={review.author} onChange={event => onReviewChange(review.id, 'author', event.target.value)} onBlur={() => onReviewBlur(review)} />
          {reviewErrors.author && <p id={`${prefix}-author-error`} className={styles.message} role="alert">{reviewErrors.author}</p>}
          <button type="button" className={styles.removeReview} onClick={() => onRemoveReview(review)}>후기 삭제</button>
        </div>;
      })}</div>
      <button type="button" className={styles.addReview} onClick={onAddReview}>후기 추가 +</button>
    </div>
  </div>;
}
