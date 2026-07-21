import { NextResponse } from 'next/server';
import { products } from '@/data/products';
import { buildAttributedUrl } from '@/modules/commerce/redirect-attribution';

export function GET(request: Request) {
  const current = new URL(request.url);
  const productSlug = current.searchParams.get('product');
  const retailerName = current.searchParams.get('retailer');

  const product = products.find(item => item.slug === productSlug);
  const offer = product?.offers.find(item => item.retailer === retailerName);

  if (!product || !offer) {
    return NextResponse.redirect(new URL('/products', request.url));
  }

  const destination = buildAttributedUrl(offer.url, {
    productSlug: product.slug,
    retailer: offer.retailer,
  });

  return NextResponse.redirect(destination, 307);
}
