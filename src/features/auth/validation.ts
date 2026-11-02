export type AuthKind = 'login' | 'signup' | 'recovery' | 'reset';
export type AuthField = 'email' | 'password' | 'confirmation' | 'name' | 'birthday' | 'phone';
export type AuthValues = Record<AuthField, string>;
export const fieldsByKind: Record<AuthKind, AuthField[]> = {
  login: ['email', 'password'], signup: ['email', 'password', 'confirmation', 'name', 'birthday', 'phone'],
  recovery: ['email', 'name', 'phone'], reset: ['password', 'confirmation'],
};
export const fieldLabels: Record<AuthField, string> = { email: '이메일', password: '비밀번호', confirmation: '비밀번호 확인', name: '이름', birthday: '생년월일', phone: '연락처' };
export const placeholders: Record<AuthField, string> = { email: '이메일을 입력해주세요.', password: '비밀번호를 입력해주세요.', confirmation: '비밀번호를 다시 한 번 입력해주세요.', name: '이름을 입력해주세요.', birthday: '생년월일 8자리를 입력해주세요.', phone: '연락처를 입력해주세요. (‘-’ 제외)' };

export function validBirthday(value: string, today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).replaceAll('-', '')) {
  if (!/^\d{8}$/.test(value) || value > today) return false;
  const year = Number(value.slice(0, 4)), month = Number(value.slice(4, 6)), day = Number(value.slice(6));
  const date = new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}T00:00:00Z`);
  return year > 0 && date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

export function validateField(field: AuthField, values: AuthValues, kind?: AuthKind): string | undefined {
  const raw = values[field];
  const value = field === 'email' || field === 'name' ? raw.trim() : field === 'phone' ? raw.replace(/[-\s]/g, '') : raw;
  if (!value) return `${field === 'confirmation' ? '비밀번호' : fieldLabels[field]}${field === 'email' || field === 'birthday' || field === 'name' ? '을' : '를'} 입력해주세요.`;
  if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return '이메일 양식으로 입력해주세요.';
  if (field === 'confirmation' && values.password && raw !== values.password) return '비밀번호가 일치하지 않습니다.';
  if (field === 'birthday' && !validBirthday(value)) return '생년월일 8자리를 정확히 입력해주세요.';
  if (field === 'phone' && kind === 'signup' && !/^\d{11}$/.test(value)) return '연락처 11자리를 입력해주세요.';
  if (field === 'phone' && !/^\d{10,11}$/.test(value)) return '연락처 10~11자리를 입력해주세요.';
}
