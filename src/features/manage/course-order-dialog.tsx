'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProducts, ProductCardContent, ProductListSkeleton, type Product } from '@/features/catalog';
import { initialProductOrder, moveProduct } from './course-order';
import type { CourseBasic, CourseProductOrder } from './types';
import styles from './course-order-dialog.module.css';
import buttons from '@/components/site/dialog.module.css';

type Props = { basic: CourseBasic; courseId?: string; value?: CourseProductOrder; onSave: (value: CourseProductOrder) => void; onCancel: () => void };

export function CourseOrderDialog(props: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const query = useQuery({ queryKey: ['products', 'order'], queryFn: () => getProducts('default'), staleTime: 0, refetchOnWindowFocus: false });
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={styles.dialog} aria-label="강의·교재 정렬" onCancel={event => { event.preventDefault(); props.onCancel(); }}>
    <h2 className={styles.title}>강의·교재 정렬</h2>
    {query.isPending || query.isFetching ? <><div className={styles.loading}><ProductListSkeleton /></div><div className={buttons.actions}><button type="button" className={buttons.outlined} onClick={props.onCancel}>취소</button></div></> : query.isError ? <>
      <p>강의·교재 목록을 불러오지 못했어요.</p>
      <div className={buttons.actions}><button type="button" className={buttons.outlined} onClick={props.onCancel}>취소</button><button type="button" className={buttons.primary} onClick={() => void query.refetch()}>다시 시도</button></div>
    </> : <OrderEditor key={query.data.items.map(product => product.id).join(',')} {...props} products={query.data.items} />}
  </dialog>;
}

function OrderEditor({ products, basic, courseId, value, onSave, onCancel }: Props & { products: Product[] }) {
  const [order, setOrder] = useState(() => initialProductOrder(products.map(product => product.id), courseId, value));
  const dragged = useRef<number | null>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const current: Product = {
    id: '', slug: '', kind: 'vod',
    title: basic.title || '클래스명', image: basic.thumbnail?.url || '/assets/listing-imgRectangle3.png',
    tags: products.find(product => product.id === courseId)?.tags ?? (basic.materials.length ? ['#강의', '#교재'] : ['#강의']),
    price: Number(basic.price.replaceAll(',', '')) || 0, basePrice: Number(basic.basePrice.replaceAll(',', '')) || undefined, publishedOrder: 0,
  };
  function move(from: number, to: number) {
    setOrder(previous => ({ ...previous, ids: moveProduct(previous.ids, from, to) }));
  }
  return <>
    <div className={styles.grid}>
      {order.ids.map((id, index) => {
        const product = id === null ? current : products.find(product => product.id === id)!;
        return <div key={id === null ? 'current' : `product:${id}`} ref={element => { cards.current[index] = element; }} className={styles.card} role="button" tabIndex={0} draggable aria-label={`${product.title}, ${index + 1}번째. 방향키로 순서 변경`} onDragStart={event => {
          dragged.current = index; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(index));
        }} onDragEnd={() => { dragged.current = null; }} onDragOver={event => { if (dragged.current !== null) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }} onDrop={event => {
          event.preventDefault(); if (dragged.current !== null) move(dragged.current, index); dragged.current = null;
        }} onKeyDown={event => {
          const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[event.key];
          if (delta === undefined) return;
          event.preventDefault(); const target = index + delta;
          if (target < 0 || target >= order.ids.length) return;
          move(index, target);
          requestAnimationFrame(() => cards.current[target]?.focus());
        }}><ProductCardContent product={product} /></div>;
      })}
    </div>
    <div className={buttons.actions}><button type="button" className={buttons.outlined} onClick={onCancel}>취소</button><button type="button" className={buttons.primary} onClick={() => onSave(order)}>저장</button></div>
  </>;
}
