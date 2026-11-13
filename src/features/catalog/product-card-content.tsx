'use client';

import Image from 'next/image';
import { discountPercent } from './api';
import type { Product } from './types';
import styles from './product-list-mobile.module.css';

export function ProductCardContent({ product }: { product: Product }) {
  const basePrice = product.basePrice;
  const price = `${product.price.toLocaleString('ko-KR')}원`;
  return <>
    <Image unoptimized loading="eager" className={styles.thumbnail} src={product.image} width={325} height={217} alt={product.title} onError={event => { event.currentTarget.src = '/assets/listing-imgRectangle3.png'; }} />
    <div className={styles.cardInfo}>
      <div className={styles.cardHeading}>
        <div className={styles.tags}>{product.tags.map(tag => <span className={styles.tag} key={tag}>{tag}</span>)}</div>
        <h2 className={styles.cardTitle}>{product.title}</h2>
      </div>
      {basePrice !== undefined && basePrice > product.price ? (
        <div className={styles.discountedPrice}>
          <p className={styles.cardBasePrice}>{basePrice.toLocaleString('ko-KR')}원</p>
          <div className={styles.cardPriceRow}>
            <p className={styles.price}>{price}</p>
            <p className={`${styles.price} ${styles.discount}`}>
              {discountPercent(basePrice, product.price)}%
              <Image unoptimized src="/assets/listing-imgDownArrowSm.svg" width={24} height={24} alt="" />
            </p>
          </div>
        </div>
      ) : <p className={styles.price}>{price}</p>}
    </div>
  </>;
}
