import type { ProductDetail, ProductList, ProductSort } from './types';

export function parseSort(value?: string): ProductSort {
  return value === 'latest' || value === 'price-asc' || value === 'price-desc' ? value : 'default';
}
export function discountPercent(base: number, price: number) { return Math.floor((base - price) * 100 / base); }
export async function getProducts(sort: ProductSort): Promise<ProductList> {
  const response = await fetch(`/api/products?sort=${sort}`);
  if (!response.ok) throw new Error('Product list request failed');
  const data: ProductList = await response.json();
  if (!Array.isArray(data.items) || !Number.isInteger(data.count)) throw new Error('Invalid product list response');
  return data;
}
export async function getProduct(slug: string, kind: 'vod' | 'pdf'): Promise<ProductDetail> {
  const response = await fetch(`/api/products/${encodeURIComponent(slug)}`);
  if (!response.ok) throw new Error('Product detail request failed');
  const data: ProductDetail = await response.json();
  if (data.kind !== kind || typeof data.title !== 'string' || !Array.isArray(data.reviews) || !Array.isArray(data.chapters) || !Number.isFinite(data.price)) throw new Error('Invalid product detail response');
  return data;
}
