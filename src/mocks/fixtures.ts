import type { AuthField } from '@/features/auth';
import type { Profile } from '@/features/account';

export const profile: Profile = { name: '홍길동', email: 'nocoders@nocoders.kr', birthday: '20140222', phone: '01032428118', image: '/assets/profile-imgFrame2.png', avatar: '/assets/profile-imgRectangle2.png', marketing: false };

export const authStates: Record<string, { field?: AuthField; message: string }> = {
  'login:credentials': { field: 'password', message: '이메일 또는 비밀번호를 확인해주세요.' },
  'login:error': { field: 'password', message: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
  'signup:duplicate': { field: 'email', message: '이미 가입한 이메일입니다.' },
  'signup:error': { message: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
  'recovery:not-found': { field: 'phone', message: '가입된 회원 정보가 없습니다.' },
};
