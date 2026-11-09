import { mutate, RequestError } from '@/lib/http';

type Checkout = { clientId:string; orderId:string; amount:number; goodsName:string; returnUrl:string };
type Nicepay = { requestPay(options: Checkout & { method:'card'; fnError:()=>void }): false | void };

let sdk:Promise<Nicepay> | undefined;

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

export async function checkout(productId:string,requestKey:string) {
  const order=await mutate<Checkout>('orders',{productId,requestKey}).catch(error=> {
    if (!(error instanceof RequestError) || error.code!=='payment_outcome_unknown') throw error;
  });
  if (!order) return;

  const nicepay=await loadNicepay();
  // The SDK posts to returnUrl on success and calls fnError if the payment window closes with an error.
  await new Promise<void>((_,reject)=> {
    const fnError=()=>reject(new Error('Payment window closed'));
    if (nicepay.requestPay({...order,method:'card',fnError})===false) fnError();
  });
}
