import { http, HttpResponse } from 'msw';
import { authStates, profile } from './fixtures';
import { classroomItems, viewer } from './classroom-fixtures';
import { exampleDetails, products, productDetail, sortProducts } from './catalog-fixtures';
import { parseSort } from '../features/catalog/api';
import { orders, refundQuote } from './order-fixtures';

export const handlers = [
  http.get('/__mock/profile', ({ request }) => {
    const state = new URL(request.url).searchParams.get('state');
    if (state === 'error') return new HttpResponse(null, { status: 500 });
    return HttpResponse.json({ ...profile, image: state === 'empty' ? '' : profile.image });
  }),
  http.get('/__mock/orders', ({ request }) => {
    const state = new URL(request.url).searchParams.get('state');
    if (state === 'error') return new HttpResponse(null, { status: 500 });
    const status = state === 'processing' ? ['환불 처리 중','처리 중'] : state === 'checking' ? ['환불 확인 중','확인 중'] : state === 'refunded' ? ['환불완료','환불 완료'] : null;
    const items = state === 'empty' ? [] : orders.map((item,index) => status && index === 0 ? {...item,status:status[0],refundLabel:status[1],refundable:false} : item);
    return HttpResponse.json({ items, count: items.length });
  }),
  http.get('/__mock/orders/:orderId/refund', ({ request, params }) => {
    if (new URL(request.url).searchParams.get('state') === 'refund-error') return new HttpResponse(null, { status: 500 });
    return params.orderId === refundQuote.orderId ? HttpResponse.json(refundQuote) : new HttpResponse(null, { status: 404 });
  }),
  http.get('/__mock/classroom', ({ request }) => {
    const state = new URL(request.url).searchParams.get('state');
    if (state === 'error') return new HttpResponse(null, { status: 500 });
    const items = state === 'empty' || state === 'hidden' ? [] : classroomItems;
    return HttpResponse.json({ items, count: items.length, hidden: state === 'hidden' });
  }),
  http.get('/__mock/courses/:courseId', ({ request, params }) => {
    const state = new URL(request.url).searchParams.get('state');
    if (state === 'error') return new HttpResponse(null, { status: 500 });
    if (params.courseId === viewer.courseId) return HttpResponse.json({ ...viewer, chapters: state === 'empty' ? [] : viewer.chapters });
    if (params.courseId === 'trigonometry-concepts') return HttpResponse.json({ ...viewer, courseId: params.courseId, title: '삼각함수 개념부터 실전까지', chapters: [] });
    return new HttpResponse(null, { status: 404 });
  }),
  http.get('/__mock/products', ({ request }) => {
    const url = new URL(request.url), state = url.searchParams.get('state');
    if (state === 'error') return new HttpResponse(null, { status: 500 });
    const items = state === 'empty' ? [] : sortProducts(products, parseSort(url.searchParams.get('sort') ?? undefined));
    return HttpResponse.json({ items, count: items.length });
  }),
  http.get('/__mock/products/:slug', ({ request, params }) => {
    const url = new URL(request.url), state = url.searchParams.get('state') ?? '', view = url.searchParams.get('view') ?? '';
    if (state === 'error') return new HttpResponse(null, { status: 500 });
    const product = [...products, ...exampleDetails].find(item => item.slug === params.slug && item.kind === url.searchParams.get('kind'));
    return product ? HttpResponse.json(productDetail(product, state, view)) : new HttpResponse(null, { status: 404 });
  }),
  http.get('/__mock/auth-state', ({ request }) => {
    const url = new URL(request.url);
    const fixture = authStates[`${url.searchParams.get('screen')}:${url.searchParams.get('state')}`];
    return fixture ? HttpResponse.json(fixture) : new HttpResponse(null, { status: 404 });
  }),
];
