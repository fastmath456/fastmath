import { SiteFooter, Skeleton } from '@/components/site';
import styles from './manage.module.css';
import basic from './basic-information.module.css';
import loading from './manage-course-skeleton.module.css';

export function ManageCourseSkeleton() {
  return <><main className={styles.main} aria-busy="true"><div className={styles.heading}><h1>클래스 등록</h1><div className={styles.steps}>{['기본정보', '상세정보'].map(label => <div className={styles.step} key={label}><Skeleton className={loading.chip} /><Skeleton className={loading.step}>{label}</Skeleton></div>)}</div></div><div className={basic.content}>{['클래스 대표이미지', '클래스 상세이미지'].map(label => <div className={basic.field} key={label}><span className={basic.label}>{label}</span><Skeleton className={loading.asset} /></div>)}{['클래스명', '교재파일', '원가(단위: 원)', '할인가(단위: 원)', '수강 가능 기간', '정렬 순서', '후기 등록'].map(label => <div className={basic.field} key={label}><span className={basic.label}>{label}</span><Skeleton className={loading.input} /></div>)}</div></main><SiteFooter /></>;
}
