export class RequestError extends Error {
  constructor(public code: string, public field?: string, public status?: number) { super(code); }
}
export function isUnauthorized(error: unknown) {
  return error instanceof RequestError && error.status === 401 && error.code === 'unauthorized';
}
export async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new RequestError(data?.error?.code ?? 'request_failed', data?.error?.field, response.status);
  return data as T;
}
export async function mutate<T = {ok:boolean}>(path: string, payload?: unknown, method = 'POST'): Promise<T> {
  const response = await fetch('/api/'+path,{method,headers:payload instanceof FormData?undefined:{'Content-Type':'application/json'},body:payload instanceof FormData?payload:JSON.stringify(payload??{}),credentials:'same-origin'});
  return readResponse<T>(response);
}

export const requestFailure = '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
