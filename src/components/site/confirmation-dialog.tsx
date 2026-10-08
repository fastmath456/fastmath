'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import styles from './dialog.module.css';

export function ConfirmationDialog({ children, label, actions, onCancel }: { children: ReactNode; label: string; actions: { label: string; cancel?: boolean; onClick?: () => void }[]; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  function cancel() {
    ref.current?.close();
    returnFocus.current?.focus();
    onCancel();
  }
  return <dialog ref={ref} className={styles.dialog} aria-label={label} onCancel={event => { event.preventDefault(); cancel(); }} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}><div className={styles.text}>{children}</div><div className={styles.actions}>{actions.map((action,index) => <button key={action.label} type="button" className={index === 0 ? styles.outlined : styles.primary} onClick={action.cancel ? cancel : action.onClick}>{action.label}</button>)}</div></dialog>;
}
