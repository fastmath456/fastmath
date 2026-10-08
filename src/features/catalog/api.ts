import type { ProductDetail, ProductList, ProductSort } from './types';

export function parseSort(value?: string): ProductSort { return value === 'price-asc' || value === 'price-desc' ? value : 'latest'; }
export function discountPercent(base: number, price: number) { return Math.floor((base - price) * 100 / base); }
export async function getProducts(sort: ProductSort, state: string): Promise<ProductList> {
  const response = await fetch(`/__mock/products?sort=${sort}&state=${encodeURIComponent(state)}`);
  if (!response.ok) throw new Error('Product list request failed');
  const data: ProductList = await response.json();
  if (!Array.isArray(data.items) || !Number.isInteger(data.count)) throw new Error('Invalid product list response');
  return data;
}
export async function getProduct(slug: string, kind: 'vod' | 'pdf', state: string, view: string): Promise<ProductDetail> {
  const response = await fetch(`/__mock/products/${encodeURIComponent(slug)}?kind=${kind}&state=${encodeURIComponent(state)}&view=${encodeURIComponent(view)}`);
  if (!response.ok) throw new Error('Product detail request failed');
  const data: ProductDetail = await response.json();
  if (typeof data.title !== 'string' || !Array.isArray(data.reviews) || !Array.isArray(data.chapters) || !Number.isFinite(data.price)) throw new Error('Invalid product detail response');
  return data;
}
