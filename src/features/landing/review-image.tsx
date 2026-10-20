import Image, { type ImageProps } from 'next/image';
import type { ReviewImage as ReviewImageData } from './reviews';
import styles from './landing.module.css';

export function ReviewImage({ part, alt, onLoad, onError }: { part: ReviewImageData; alt: string } & Pick<ImageProps, 'onLoad' | 'onError'>) {
  return <div className={styles.reviewImage} style={{ aspectRatio: `${part.width} / ${part.height}` }}>
    <Image unoptimized loading="eager" src={part.src} width={part.width} height={part.height} alt={alt} onLoad={onLoad} onError={onError}
      style={part.crop ? { height: `${part.crop.heightPercent}%`, top: `${part.crop.topPercent}%`, objectFit: 'fill' } : undefined} />
  </div>;
}
