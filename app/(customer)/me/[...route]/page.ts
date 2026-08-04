import { createElement } from 'react';
import { notFound } from 'next/navigation';
import { MePortal } from '@/components/me/home/me-home';
import {
  resolveMeProductOrigin,
  type MePortalRoute,
} from '@/components/me/shell/me-shell-model';
import { requireCustomer } from '@/lib/customer/access';
import { readCustomerPortal } from '@/lib/customer/read-model';
import { findCatalogueProduct } from '@/lib/catalogue/repository';
import { readProductPanelData, type ProductPanelData } from '@/lib/catalogue/product-panel-model';

export const dynamic = 'force-dynamic';

function parseRoute(parts: readonly string[], from: string | string[] | undefined): MePortalRoute | null {
  if (parts.length === 1) {
    const [section] = parts;
    if (section === 'explore' || section === 'shelf' || section === 'routine' || section === 'consult') {
      return { kind: section };
    }
  }

  if (parts.length === 2 && parts[0] === 'product' && parts[1]) {
    const origin = resolveMeProductOrigin(from);
    return { kind: 'product', slug: parts[1], origin };
  }

  return null;
}

export default async function MeRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ route: string[] }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const [{ route: parts }, query] = await Promise.all([params, searchParams]);
  const route = parseRoute(parts, query.from);
  if (!route) notFound();

  const customer = await requireCustomer();
  const viewModel = await readCustomerPortal(customer);
  let productPanelData: ProductPanelData | undefined;
  if (route.kind === 'product') {
    if (!viewModel.catalogue?.some((product) => product.slug === route.slug)) notFound();
    const selectedProduct = await findCatalogueProduct(route.slug);
    if (!selectedProduct) notFound();
    productPanelData = await readProductPanelData(selectedProduct);
  }

  return createElement(MePortal, { viewModel, route, productPanelData });
}
