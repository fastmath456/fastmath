import type { ComponentProps } from 'react';
import styles from './skeleton.module.css';

export function Skeleton({ className = '', ...props }: ComponentProps<'span'>) {
  return <span {...props} aria-hidden="true" className={`${styles.skeleton} ${className}`} />;
}
