import { mutate } from '@/lib/http';
type Checkout = { orderId:string;orderName:string;amount:number;customerKey:string;clientKey:string };
type Toss = (key:string) => {payment: (options:{customerKey:string}) => {requestPayment:(options: {method:'CARD';amount:{currency:'KRW';value:number};orderId:string;orderName:string;successUrl:string;failUrl:string})=>Promise<void>}};
let sdk:Promise<Toss> | undefined;
function loadToss() {
  return sdk ??= new Promise<Toss>((resolve,reject) => {
    const script=document.createElement('script');script.src='https://js.tosspayments.com/v2/standard';
    script.onload=()=> { const toss=(window as Window & {TossPayments?:Toss}).TossPayments; if(toss) resolve(toss); else reject(new Error('Payment SDK unavailable')); };
    script.onerror=()=> { sdk=undefined; script.remove(); reject(new Error('Payment SDK unavailable')); };document.head.append(script);
  });
}
export async function checkout(productId:string,requestKey:string) {
  const order=await mutate<Checkout>('orders',{productId,requestKey});
  const toss=await loadToss();
  await toss(order.clientKey).payment({customerKey:order.customerKey}).requestPayment({method:'CARD',amount:{currency:'KRW',value:order.amount},orderId:order.orderId,orderName:order.orderName,successUrl:location.origin+'/payments/success',failUrl:location.origin+'/payments/failure'});
}
