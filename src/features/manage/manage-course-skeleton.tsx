import { SiteFooter, Skeleton } from '@/components/site';
import styles from './manage.module.css';
import basic from './basic-information.module.css';
import loading from './manage-course-skeleton.module.css';

export function ManageCourseSkeleton() {
  return <><main className={styles.main} aria-busy="true"><div className={styles.heading}><h1>클래스 등록</h1><Skeleton className={loading.step} /></div><div className={basic.content}>{['클래스 대표이미지', '클래스 상세이미지'].map(label => <div className={basic.field} key={label}><span className={basic.label}>{label}</span><Skeleton className={loading.asset} /></div>)}{['클래스명', '교재파일', '원가(단위: 원)', '할인가(단위: 원)', '수강 가능 기간'].map(label => <div className={basic.field} key={label}><span className={basic.label}>{label}</span><Skeleton className={loading.input} /></div>)}</div></main><SiteFooter /></>;
}
