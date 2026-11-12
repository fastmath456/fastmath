import { book, course } from '../storybook/fixtures';

export async function checkoutProductReturnHref(productId: unknown, kind: 'vod' | 'pdf') {
  const product = kind === 'vod' ? course : book;
  if (productId !== product.id) return null;
  return `/${kind === 'vod' ? 'courses' : 'books'}/${product.slug}`;
}
