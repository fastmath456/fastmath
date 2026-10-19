'use client';

import Image from 'next/image';
import { useId, useRef, type ChangeEvent } from 'react';
import type { AssetSlot, BasicErrors, CourseAsset, CourseBasic } from './types';
import { formattedPrice } from './validation';
import styles from './basic-information.module.css';

type BasicInformationProps = {
  basic: CourseBasic;
  errors: BasicErrors;
  uploading: Partial<Record<AssetSlot, boolean>>;
  uploadErrors: Partial<Record<AssetSlot, string>>;
  onChange: (field: 'title' | 'basePrice' | 'price' | 'licenseDays', value: string) => void;
  onBlur: (field: 'title' | 'basePrice' | 'price' | 'licenseDays') => void;
  onUpload: (slot: AssetSlot, files: File[]) => void;
  onRemoveMaterial: (id: string) => void;
  onRetryMaterial: (id: string) => void;
};

type TextField = 'title' | 'basePrice' | 'price';

const fieldDetails: Record<TextField, { label: string; placeholder: string; inputMode?: 'numeric' }> = {
  title: { label: '클래스명', placeholder: '클래스명을 입력해주세요.' },
  basePrice: { label: '원가(단위: 원)', placeholder: '강의 원가를 입력해주세요.', inputMode: 'numeric' },
  price: { label: '할인가(단위: 원)', placeholder: '강의 할인가를 입력해주세요.', inputMode: 'numeric' },
};

function messageFor(slot: AssetSlot, errors: BasicErrors, uploadErrors: BasicInformationProps['uploadErrors']) {
  return uploadErrors[slot] ?? errors[slot === 'material' ? 'materials' : slot];
}

function AssetUpload({ asset, helper, label, message, slot, uploading, onUpload }: {
  asset: CourseAsset | null;
  helper?: string;
  label: string;
  message?: string;
  slot: Extract<AssetSlot, 'thumbnail' | 'detailImage'>;
  uploading: boolean;
  onUpload: BasicInformationProps['onUpload'];
}) {
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  function select(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length > 0) onUpload(slot, files);
  }

  return <div className={styles.field}>
    <div className={styles.assetHeading}><label htmlFor={inputId} className={styles.label}>{label}<span aria-hidden="true" className={styles.required}>*</span></label>{helper && <p className={styles.helper}>{helper}</p>}</div>
    <input ref={input} id={inputId} className={styles.fileInput} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={select} />
    <button id={`course-${slot}`} type="button" className={styles.assetUpload} onClick={() => input.current?.click()} aria-label={`${label} ${asset ? '교체' : '업로드'}`} disabled={uploading}>
      {asset ? <Image unoptimized className={styles.assetPreview} src={asset.url} width={144} height={144} alt={`${label} 미리보기`} /> : <span className={styles.uploadPrompt}><span className={styles.imageIcon}><Image unoptimized src="/assets/manage-image-upload.svg" width={20} height={20} alt="" /></span><span>이미지 업로드</span></span>}
    </button>
    {uploading && <p className={styles.status} role="status">업로드 중...</p>}
    {message && <p className={styles.message} role="alert">{message}</p>}
  </div>;
}

export function BasicInformation({ basic, errors, uploading, uploadErrors, onChange, onBlur, onUpload, onRemoveMaterial, onRetryMaterial }: BasicInformationProps) {
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
    <AssetUpload asset={basic.thumbnail} label="클래스 대표이미지" message={messageFor('thumbnail', errors, uploadErrors)} slot="thumbnail" uploading={Boolean(uploading.thumbnail)} onUpload={onUpload} />
    <AssetUpload asset={basic.detailImage} helper="* 높이 3000px 이하의 사이즈를 권장합니다." label="클래스 상세이미지" message={messageFor('detailImage', errors, uploadErrors)} slot="detailImage" uploading={Boolean(uploading.detailImage)} onUpload={onUpload} />
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
  </div>;
}
