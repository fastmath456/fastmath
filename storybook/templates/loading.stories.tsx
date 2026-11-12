import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { OrdersLoading, ProfileLoading } from '@/features/account';
import { ProductDetailLoading, ProductListLoading } from '@/features/catalog';
import { ClassroomLoading, ViewerLoading } from '@/features/classroom';
import { ManageCourseSkeleton } from '@/features/manage/manage-course-skeleton';

const meta = { title: 'Templates/Loading' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Catalog: Story = { name: '강의·교재 목록', render: () => <ProductListLoading /> };
export const Course: Story = { name: '강의 상세', render: () => <ProductDetailLoading kind="vod" /> };
export const Book: Story = { name: '교재 상세', render: () => <ProductDetailLoading kind="pdf" /> };
export const Classroom: Story = { name: '내 강의실', render: () => <ClassroomLoading /> };
export const Viewer: Story = { name: '강의 재생 화면', render: () => <ViewerLoading /> };
export const Profile: Story = { name: '내 정보', render: () => <ProfileLoading /> };
export const Orders: Story = { name: '내 결제내역', render: () => <OrdersLoading /> };
export const Manage: Story = { name: '클래스 등록', render: () => <ManageCourseSkeleton /> };
