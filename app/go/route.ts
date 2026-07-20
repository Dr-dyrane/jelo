import { NextResponse } from 'next/server';
import { products } from '@/data/products';

const allowed = new Set(products.flatMap(product => product.offers.map(offer => offer.url)));

export function GET(request: Request) {
  const url = new URL(request.url).searchParams.get('url');
  if (!url || !allowed.has(url)) return NextResponse.redirect(new URL('/products', request.url));
  return NextResponse.redirect(url, 307);
}
