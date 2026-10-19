export const isMockMode = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_API_MODE !== 'real';
export const dataPath = (mock: string, real: string) => isMockMode ? mock : real;
export class RequestError extends Error {
  constructor(public code: string, public field?: string) { super(code); }
}
export async function mutate<T = {ok:boolean}>(path: string, payload?: unknown, method = 'POST'): Promise<T> {
  const response = await fetch('/api/'+path,{method,headers:payload instanceof FormData?undefined:{'Content-Type':'application/json'},body:payload instanceof FormData?payload:JSON.stringify(payload??{}),credentials:'same-origin'});
  const data=await response.json(); if(!response.ok) throw new RequestError(data.error?.code??'request_failed',data.error?.field); return data as T;
}

export const requestFailure = '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
