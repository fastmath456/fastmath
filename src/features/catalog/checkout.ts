import { mutate, RequestError } from '@/lib/http';

type Checkout = { clientId:string; orderId:string; amount:number; goodsName:string; returnUrl:string };
type CheckoutInput = { productId:string; requestKey:string } | { retryOrderId:string };
type Nicepay = { requestPay(options: Checkout & { method:'card'; fnError:()=>void }): false | void };

let sdk:Promise<Nicepay> | undefined;
const retryStoragePrefix = 'course-checkout:';

function loadNicepay() {
  return sdk ??= new Promise<Nicepay>((resolve,reject) => {
    const script=document.createElement('script');
    script.src='https://pay.nicepay.co.kr/v1/js/';
    const unavailable=()=> { sdk=undefined; script.remove(); reject(new Error('Payment SDK unavailable')); };
    script.onload=()=> {
      const nicepay=(window as Window & {AUTHNICE?:Nicepay}).AUTHNICE;
      if (nicepay) resolve(nicepay);
      else unavailable();
    };
    script.onerror=unavailable;
    document.head.append(script);
  });
}

async function openCheckout(input: CheckoutInput, signal?: AbortSignal) {
  const order=await mutate<Checkout>('orders',input).catch(error=> {
    if (!(error instanceof RequestError) || error.code!=='payment_outcome_unknown') throw error;
  });
  if (!order || signal?.aborted) return;

  const nicepay=await loadNicepay();
  if (signal?.aborted) return;
  // The SDK posts to returnUrl on success and calls fnError if the payment window closes with an error.
  await new Promise<void>((_,reject)=> {
    const fnError=()=>reject(new Error('Payment window closed'));
    if (nicepay.requestPay({...order,method:'card',fnError})===false) fnError();
  });
}

export function checkout(productId: string, requestKey: string) {
  return openCheckout({ productId, requestKey });
}

export function coursePaymentFailureHref(productId: string, requestKey: string) {
  const failureHref = `/payments/failure?kind=vod&productId=${encodeURIComponent(productId)}`;
  // Retries use the originating tab's product instead of trusting the URL.
  try { sessionStorage.setItem(retryStoragePrefix + requestKey, productId); }
  catch { return failureHref; }
  return `${failureHref}&requestKey=${encodeURIComponent(requestKey)}`;
}

export async function retryCourseCheckout({ orderId, requestKey }: { orderId?: string; requestKey?: string }, signal: AbortSignal) {
  if (orderId) return openCheckout({ retryOrderId: orderId }, signal);
  if (!requestKey) return;
  let productId: string | null;
  try { productId = sessionStorage.getItem(retryStoragePrefix + requestKey); }
  catch { return; }
  if (productId) return openCheckout({ productId, requestKey }, signal);
}
