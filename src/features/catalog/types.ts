export type Product = { id: string; slug: string; kind: 'vod' | 'pdf'; title: string; tags: string[]; price: number; basePrice?: number; image: string; publishedOrder: number };
export type Lesson = { id: string; title: string; duration: string; preview?: boolean };
export type Chapter = { id: string; title: string; lessons: Lesson[] };
export type Review = { body: string; author: string; date: string; rating: number };
export type ProductDetail = Product & { chapters: Chapter[]; reviews: Review[]; ownership: 'none' | 'owned'; selling: boolean; admin: boolean; profile?: { name: string; image: string } };
export type ProductList = { items: Product[]; count: number };
export type ProductSort = 'latest' | 'price-asc' | 'price-desc';
