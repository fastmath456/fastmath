import { http, HttpResponse } from 'msw';
import { adminRefundDetails, adminRefunds, book, catalog, classroom, course, draft, orders, profile, refundQuote, review, viewer } from './fixtures';

export const apiError = (status: number, code: string) => HttpResponse.json({ error: { code } }, { status });

export const handlers = {
  catalog: http.get('/api/products', ({ request }) => {
    const sort = new URL(request.url).searchParams.get('sort');
    const items = [...catalog.items];
    if (sort === 'latest' || sort === 'price-asc') items.reverse();
    return HttpResponse.json({ ...catalog, items });
  }),
  product: http.get('/api/products/:slug', ({ params }) => {
    const product = catalog.items.find(item => item.slug === params.slug);
    return product ? HttpResponse.json(product) : apiError(404, 'not_found');
  }),
  profile: http.get('/api/profile', () => HttpResponse.json(profile)),
  saveProfile: http.patch('/api/profile', async ({ request }) => {
    const changes = await request.json() as Partial<typeof profile>;
    return HttpResponse.json({ ...profile, ...changes, revision: 'storybook-saved' });
  }),
  orders: http.get('/api/orders', () => HttpResponse.json(orders)),
  quote: http.get('/api/orders/:id/refund-quote', () => HttpResponse.json(refundQuote)),
  paymentStatus: http.get('/api/orders/:id/payment-status', ({ params }) => {
    const order = orders.items.find(item => item.id === params.id);
    return order ? HttpResponse.json({ status: 'paid', kind: order.kind }) : apiError(404, 'not_found');
  }),
  checkout: http.post('/api/orders', () => apiError(409, 'payment_conflict')),
  classroom: http.get('/api/classroom', () => HttpResponse.json(classroom)),
  viewer: http.get(`/api/classroom/courses/${course.id}`, () => HttpResponse.json(viewer)),
  preview: http.get(`/api/classroom/courses/${course.id}/preview`, () => HttpResponse.json({
    ...viewer, orderId: undefined, previewUrl: 'https://player.vimeo.com/video/1',
  })),
  playback: http.post('/api/playback', () => HttpResponse.json({ sessionId: 'storybook', url: 'https://player.vimeo.com/video/1' })),
  // Render a poster inside the real player container without loading Vimeo or playing media.
  videoSdk: http.get('https://player.vimeo.com/api/player.js', () => HttpResponse.text(`
    window.Vimeo = { Player: class {
      constructor(container) {
        this.video = document.createElement('video');
        this.video.poster = ${JSON.stringify(viewer.poster)};
        this.video.style.cssText = 'width:100%;height:100%';
        container.append(this.video);
      }
      ready() { return Promise.resolve(); }
      on() {}
      destroy() { this.video.remove(); return Promise.resolve(); }
    } };
  `, { headers: { 'Content-Type': 'application/javascript' } })),
  reviews: http.get('/api/landing/reviews', () => HttpResponse.json({ items: [review], admin: false })),
  access: http.get('/api/admin/courses/access', () => HttpResponse.json({ admin: true })),
  draft: http.get(`/api/admin/courses/drafts/${draft.id}`, () => HttpResponse.json({ draft })),
  editCourse: http.get(`/api/admin/courses/${course.id}`, () => HttpResponse.json({ draft: { ...draft, id: '' } })),
  adminRefunds: http.get('/api/admin/refunds', () => HttpResponse.json({ items: adminRefunds })),
  adminRefund: http.get('/api/admin/refunds/:orderId', ({ params }) => {
    const refund = Object.values(adminRefundDetails).find(item => item.orderId === params.orderId);
    return refund ? HttpResponse.json(refund) : apiError(404, 'not_found');
  }),
};

export const checkoutProduct = (product: typeof course | typeof book) => http.get(`/api/products/${product.slug}`, () =>
  HttpResponse.json({ ...product, profile: { name: profile.name, image: profile.avatar } }));
