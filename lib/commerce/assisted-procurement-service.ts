import 'server-only';

import { productBySlug as findStaticProductBySlug } from '@/data/catalogue';
import type { Product } from '@/data/products';
import { findCatalogueProduct } from '@/lib/catalogue/repository';
import { findRetailerBasketOptions } from './retailer-basket';
import type { CreateAssistedOrderInput } from './assisted-procurement-schema';
import {
  createAssistedOrder,
  type CreateAssistedOrderRecord,
} from './assisted-procurement-repository';
import {
  assistedOrderFixtureEnabled,
  createOrderReference,
  createOrderRequestFingerprint,
  createOrderSecret,
  hashOrderSecret,
} from './assisted-procurement-security';

export class AssistedOrderInputError extends Error {
  constructor(public readonly code: 'products' | 'retailer' | 'stock' | 'evidence') {
    super(`assisted_order_${code}`);
  }
}

type AssistedOrderRequestDependencies = {
  resolveProduct: (slug: string) => Product | undefined | Promise<Product | undefined>;
  now: number | Date;
};

export async function requestAssistedOrder(
  input: CreateAssistedOrderInput,
  ownerSubject: string | null,
  dependencyOverrides: Partial<AssistedOrderRequestDependencies> = {},
) {
  const resolveProduct = dependencyOverrides.resolveProduct ?? (assistedOrderFixtureEnabled()
    ? findStaticProductBySlug
    : findCatalogueProduct);
  const products = await Promise.all(input.lines.map(line => resolveProduct(line.slug)));
  if (products.some(product => !product)) throw new AssistedOrderInputError('products');
  const exactProducts = products.filter((product): product is NonNullable<typeof product> => Boolean(product));
  const quantityBySlug = new Map(input.lines.map(line => [line.slug, line.quantity]));
  const retailerOption = findRetailerBasketOptions(
    exactProducts,
    quantityBySlug,
    dependencyOverrides.now ?? Date.now(),
  ).find(option => option.retailer === input.retailer);
  if (!retailerOption) throw new AssistedOrderInputError('retailer');
  if (!retailerOption.allInStock) throw new AssistedOrderInputError('stock');

  const productBySlug = new Map(exactProducts.map(product => [product.slug, product]));
  const lines: CreateAssistedOrderRecord['lines'] = retailerOption.offers.map(bundleOffer => {
    const product = productBySlug.get(bundleOffer.productSlug)!;
    const sourceOffer = product.offers.find(offer =>
      offer.retailer === input.retailer
      && offer.url === bundleOffer.url
      && offer.listingEvidence,
    );
    const evidence = sourceOffer?.listingEvidence;
    if (!evidence) throw new AssistedOrderInputError('evidence');
    return {
      slug: product.slug,
      brand: product.brand,
      name: product.name,
      size: product.size,
      image: product.image,
      quantity: quantityBySlug.get(product.slug) ?? 1,
      observedUnitPriceNgn: bundleOffer.priceNgn,
      observedListingUrl: bundleOffer.url,
      observedEvidenceReference: `${evidence.basis}:${evidence.sourceUrl}`,
      observedAt: evidence.observedAt,
    };
  });

  const sessionSecret = createOrderSecret();
  const recoverySecret = createOrderSecret();
  const order = await createAssistedOrder({
    requestKeyHash: hashOrderSecret(input.requestId),
    requestFingerprint: createOrderRequestFingerprint(input.requestId, JSON.stringify({
      ownerSubject,
      retailer: input.retailer,
      lines: [...input.lines].sort((a, b) => a.slug.localeCompare(b.slug)),
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      deliveryAddress: input.deliveryAddress,
      deliveryCity: input.deliveryCity,
      deliveryState: input.deliveryState,
      deliveryInstructions: input.deliveryInstructions,
      whatsappConsent: input.whatsappConsent,
      emailNotificationsConsent: input.emailNotificationsConsent,
    })),
    reference: createOrderReference(),
    ownerSubject,
    retailer: input.retailer,
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    deliveryAddress: input.deliveryAddress,
    deliveryCity: input.deliveryCity,
    deliveryState: input.deliveryState,
    deliveryInstructions: input.deliveryInstructions || null,
    whatsappConsent: input.whatsappConsent,
    emailNotificationsConsent: input.emailNotificationsConsent,
    sessionHash: hashOrderSecret(sessionSecret),
    recoveryHash: hashOrderSecret(recoverySecret),
    lines,
  });
  return { order, sessionSecret, recoverySecret };
}
