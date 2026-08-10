import { createElement } from 'react';
import { notFound } from 'next/navigation';
import { MePortal } from '@/components/me/home/me-home';
import {
  resolveMeProductOrigin,
  type MePortalRoute,
} from '@/components/me/shell/me-shell-model';
import { requireCustomer } from '@/lib/customer/access';
import { readCustomerPortal } from '@/lib/customer/read-model';
import { readMeConsult, readMeExplore, readMeProduct, readMeRoutine } from '@/lib/customer/route-read-models';
import { findCatalogueProduct } from '@/lib/catalogue/repository';
import { readProductPanelData } from '@/lib/catalogue/product-panel-model';

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

  if (parts.length === 2 && parts[0] === 'shelf' && parts[1] === 'add') {
    return { kind: 'shelf-add' };
  }

  if (parts.length === 3 && parts[0] === 'shelf' && parts[1] === 'request' && parts[2]) {
    return { kind: 'shelf-request', id: parts[2] };
  }

  return null;
}

export default async function MeRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ route: string[] }>;
  searchParams: Promise<{
    from?: string | string[];
    outcome?: string | string[];
  }>;
}) {
  const [{ route: parts }, query] = await Promise.all([params, searchParams]);
  const route = parseRoute(parts, query.from);
  if (!route) notFound();

  const continuation = route.kind === 'product'
    ? `/me/product/${route.slug}?from=${route.origin}`
    : route.kind === 'explore'
      ? '/me/explore'
    : route.kind === 'routine'
      ? '/me/routine'
      : undefined;
  const customer = await requireCustomer(continuation);

  // Product route uses a route-scoped reader, not the portal-wide loader.
  if (route.kind === 'product') {
    // One exact catalogue lookup — shared by the read model and the panel.
    const selectedProduct = await findCatalogueProduct(route.slug);
    if (!selectedProduct) notFound();
    // One `now` for the entire route — inline reading and panel agree.
    const now = Date.now();
    const [productReadModel, productPanelData] = await Promise.all([
      readMeProduct(customer, selectedProduct, now),
      readProductPanelData(selectedProduct, now),
    ]);
    if (!productReadModel.product) notFound();
    return createElement(MePortal, {
      route,
      productReadModel,
      productPanelData,
    });
  }

  if (route.kind === 'explore') {
    const exploreModel = await readMeExplore(customer);
    return createElement(MePortal, { route, exploreModel });
  }

  if (route.kind === 'routine') {
    const routineModel = await readMeRoutine(customer);
    const productRequestOutcome = typeof query.outcome === 'string' ? query.outcome : undefined;
    return createElement(MePortal, { route, routineModel, productRequestOutcome });
  }

  if (route.kind === 'consult') {
    const consultModel = await readMeConsult(customer);
    return createElement(MePortal, { route, consultModel });
  }

  const viewModel = await readCustomerPortal(customer);

  const productRequestPresentation = viewModel.account.synthetic
    && (route.kind === 'shelf' || route.kind === 'shelf-request')
    ? (await import('@/lib/customer/legacy-product-request-fixture'))
        .createSyntheticProductRequestPresentation(
          route.kind === 'shelf-request' ? route.id : undefined,
        )
    : undefined;

  const productRequestOutcome = typeof query.outcome === 'string' ? query.outcome : undefined;
  return createElement(MePortal, {
    viewModel,
    route,
    productRequestOutcome,
    productRequestPresentation,
  });
}
