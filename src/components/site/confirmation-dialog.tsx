'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import styles from './dialog.module.css';

export function ConfirmationDialog({ children, label, actions, onCancel, dimmed = false }: {
  children: ReactNode;
  label: string;
  actions: { label: string; cancel?: boolean; primary?: boolean; onClick?: () => void }[];
  onCancel: () => void;
  dimmed?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); returnFocus.current?.focus(); };
  }, []);
  function cancel() {
    ref.current?.close();
    returnFocus.current?.focus();
    onCancel();
  }
  return <dialog ref={ref} className={dimmed ? `${styles.dialog} ${styles.dimmed}` : styles.dialog} aria-label={label} onCancel={event => { event.preventDefault(); cancel(); }} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), a[href]');
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <div className={styles.text}>{children}</div>
    <div className={styles.actions}>{actions.map((action, index) =>
      <button key={action.label} type="button" className={action.primary || index > 0 ? styles.primary : styles.outlined} onClick={action.cancel ? cancel : action.onClick}>{action.label}</button>
    )}</div>
  </dialog>;
}
