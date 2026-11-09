import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { ApiError, integer, setting, string, uuid } from './http';

const callbackLifetime = 60 * 60 * 1000;
export const approvalTimeout = 30_000;

export function nicepayConfig() {
  const environment = process.env.NICEPAY_ENV ?? 'sandbox';
  if (environment !== 'sandbox' && environment !== 'live') throw new ApiError(503, 'configuration_invalid');
  const clientId = setting('NICEPAY_CLIENT_ID');
  const secretKey = setting('NICEPAY_SECRET_KEY');
  const live = environment === 'live';
  if (!clientId.startsWith(live ? 'R2_' : 'S2_')) throw new ApiError(503, 'configuration_invalid');
  return { environment, clientId, secretKey, apiOrigin: live ? 'https://api.nicepay.co.kr' : 'https://sandbox-api.nicepay.co.kr' };
}

type Config = ReturnType<typeof nicepayConfig>;

export function requireNicepayWrites(config: Config) {
  if (config.environment === 'live' && process.env.ALLOW_LIVE_PAYMENTS !== 'true') {
    throw new ApiError(503, 'live_payments_disabled');
  }
}

function equalDigest(expected: Buffer, value: unknown) {
  return typeof value === 'string' && /^[\da-f]{64}$/i.test(value) && timingSafeEqual(expected, Buffer.from(value, 'hex'));
}

function callbackMac(config: Config, value: string) {
  return createHmac('sha256', config.secretKey).update(`quick-math:nicepay:${config.clientId}:${value}`).digest();
}

export function nicepayReturnUrl(config: Config, attemptId: string) {
  const url = new URL('/api/payments/nicepay/callback', setting('APP_ORIGIN'));
  const value = `${attemptId}.${Date.now() + callbackLifetime}`;
  url.searchParams.set('state', `${value}.${callbackMac(config, value).toString('hex')}`);
  return url.toString();
}

export function nicepayCallbackAttempt(config: Config, request: Request) {
  const state = new URL(request.url).searchParams.get('state') ?? '';
  const [id, expires, signature, extra] = state.split('.');
  if (extra !== undefined || state.length > 120 || !/^\d{13}$/.test(expires) || Number(expires) < Date.now()
    || !equalDigest(callbackMac(config, `${id}.${expires}`), signature)) {
    throw new ApiError(400, 'invalid_payment_state');
  }
  return uuid(id, 'orderId');
}

export function validNicepaySignature(config: Config, signature: unknown, ...fields: (string | number)[]) {
  const digest = createHash('sha256').update(fields.join('') + config.secretKey).digest();
  return equalDigest(digest, signature);
}

export function nicepayGoodsName(title: string) {
  let bytes = 0;
  let name = '';
  for (const character of title) {
    bytes += Buffer.byteLength(character);
    if (bytes > 40) break;
    name += character;
  }
  return name.trimEnd();
}

export type NicepayPayment = ReturnType<typeof readNicepayPayment>;

export function readNicepayPayment(config: Config, data: Record<string, unknown>) {
  const tid = string(data.tid, 'tid', 30);
  const amount = integer(data.amount, 'amount');
  const ediDate = string(data.ediDate, 'ediDate', 40);
  if (!validNicepaySignature(config, data.signature, tid, amount, ediDate)) {
    throw new ApiError(400, 'invalid_payment_signature');
  }
  return {
    tid, amount,
    orderId: string(data.orderId, 'orderId', 64),
    status: string(data.status, 'status', 20),
    paidAt: data.paidAt,
    resultCode: data.resultCode,
    currency: data.currency,
    payMethod: data.payMethod,
    balance: integer(data.balanceAmt, 'balanceAmt'),
    cancelledTid: data.cancelledTid,
    canPartCancel: (data.card as { canPartCancel?: unknown } | null)?.canPartCancel,
    cancels: Array.isArray(data.cancels) ? data.cancels.map(cancel => ({
      tid: string(cancel?.tid, 'cancel.tid', 30),
      amount: integer(cancel?.amount, 'cancel.amount'),
    })) : [],
  };
}

export async function nicepayRequest(config: Config, path: string, payload?: Record<string, unknown>) {
  if (payload) requireNicepayWrites(config);
  const signal=AbortSignal.timeout(approvalTimeout);
  const response = await fetch(`${config.apiOrigin}/v1/payments/${path}`, {
    method: payload ? 'POST' : 'GET',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.secretKey}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    ...(payload && { body: JSON.stringify(payload) }),
    cache: 'no-store',
    redirect: 'error',
    signal,
  }).catch(() => { throw new ApiError(503, 'payment_outcome_unknown'); });
  if (!response.ok) throw new ApiError(response.status >= 500 ? 503 : 409, 'payment_outcome_unknown');
  const data: unknown = await response.json().catch(() => {
    if (signal.aborted) throw new ApiError(503, 'payment_outcome_unknown');
    return null;
  });
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ApiError(502, 'invalid_payment_response');
  return data as Record<string, unknown>;
}
