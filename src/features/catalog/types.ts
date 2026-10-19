export type Product = { id: string; slug: string; kind: 'vod' | 'pdf'; title: string; tags: string[]; price: number; basePrice?: number; image: string; publishedOrder: number };
export type Lesson = { id: string; title: string; duration: string; preview?: boolean };
export type Chapter = { id: string; title: string; lessons: Lesson[] };
export type Review = { body: string; author: string; date: string; rating: number };
export type ProductAsset = { id: string; name: string; size: number; type: string; width: number | null; height: number | null };
export type ProductDetail = Product & { chapters: Chapter[]; reviews: Review[]; ownership: 'none' | 'owned'; selling: boolean; admin: boolean; licenseDays?: number; detailImage?: (ProductAsset & { url: string }) | null; materials?: ProductAsset[]; profile?: { name: string; image: string } };
export type ProductList = { profile?: {name:string;image:string}; items: Product[]; count: number };
export type ProductSort = 'latest' | 'price-asc' | 'price-desc';
