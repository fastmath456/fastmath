'use client';

import { useState, type InputHTMLAttributes } from 'react';
import styles from './site.module.css';

export function PasswordInput({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const [visible, setVisible] = useState(false);
  return <div className={styles.passwordControl}>
    <input {...props} type={visible ? 'text' : 'password'} className={`${styles.input} ${styles.passwordInput}`} />
    <button type="button" className={styles.passwordToggle} aria-label={`${label} ${visible ? '숨기기' : '보기'}`} aria-pressed={visible} disabled={props.disabled} onMouseDown={event => event.preventDefault()} onClick={() => setVisible(current => !current)}>
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
        {!visible && <path d="M4 4l16 16" />}
      </svg>
    </button>
  </div>;
}
