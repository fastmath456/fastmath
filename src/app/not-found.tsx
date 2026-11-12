import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/site';
import styles from '@/features/catalog/catalog.module.css';
import mobileStyles from '@/features/catalog/product-detail-mobile.module.css';

export default function NotFound() {
  return <>
    <SiteHeader mobileAt1080 />
    <main className={`${styles.detail} ${mobileStyles.detail}`}>
      <div className={styles.requestError}>
        <h1>페이지를 찾을 수 없습니다.</h1>
        <Link href="/">홈으로</Link>
      </div>
    </main>
    <SiteFooter />
  </>;
}
