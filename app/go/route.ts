import { NextResponse } from 'next/server';
import { retailerSearchUrl } from '@/data/retailers';
import { findCatalogueProduct } from '@/lib/catalogue/repository';
import { buildAttributedUrl } from '@/modules/commerce/redirect-attribution';

export async function GET(request: Request) {
  const current = new URL(request.url);
  const productSlug = current.searchParams.get('product');
  const retailerName = current.searchParams.get('retailer');
  const product = productSlug ? await findCatalogueProduct(productSlug) : undefined;
  const offer = product?.offers.find(item => item.retailer === retailerName);
  if (!product) return NextResponse.redirect(new URL('/products', request.url));
  if (offer) return NextResponse.redirect(buildAttributedUrl(offer.url, { productSlug: product.slug, retailer: offer.retailer }), 307);

  const searchUrl = retailerName
    ? retailerSearchUrl(retailerName, `${product.brand} ${product.name} ${product.size}`)
    : undefined;
  if (!searchUrl || !retailerName) return NextResponse.redirect(new URL('/products', request.url));
  return NextResponse.redirect(buildAttributedUrl(searchUrl, { productSlug: product.slug, retailer: retailerName }), 307);
}
