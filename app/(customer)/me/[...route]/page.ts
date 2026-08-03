import { createElement } from 'react';
import { notFound } from 'next/navigation';
import { MePortal, type MePortalRoute } from '@/components/me/home/me-home';
import { requireCustomer } from '@/lib/customer/access';
import { readCustomerPortal } from '@/lib/customer/read-model';

export const dynamic = 'force-dynamic';

const PRODUCT_ORIGINS = new Set(['home', 'explore', 'shelf', 'routine', 'consult']);

function parseRoute(parts: readonly string[], from: string | string[] | undefined): MePortalRoute | null {
  if (parts.length === 1) {
    const [section] = parts;
    if (section === 'explore' || section === 'shelf' || section === 'routine' || section === 'consult') {
      return { kind: section };
    }
  }

  if (parts.length === 2 && parts[0] === 'product' && parts[1]) {
    const origin = typeof from === 'string' && PRODUCT_ORIGINS.has(from)
      ? from as 'home' | 'explore' | 'shelf' | 'routine' | 'consult'
      : 'explore';
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
  const viewModel = readCustomerPortal(customer);
  if (route.kind === 'product' && !viewModel.catalogue?.some((product) => product.slug === route.slug)) {
    notFound();
  }

  return createElement(MePortal, { viewModel, route });
}
