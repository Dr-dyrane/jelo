import type { Metadata, Viewport } from 'next';
import { unstable_noStore as noStore } from 'next/cache';
import type { ReactNode } from 'react';
import { BasketProvider } from '@/components/commerce/basket-provider';
import { PublicBasketPill } from '@/components/commerce/public-basket-pill';
import { MeShelfStateProvider } from '@/components/me/shelf/me-shelf-state';
import { MeConcernStateProvider } from '@/components/me/consult/me-concern-state';
import { MeExploreStateProvider } from '@/components/me/explore/me-explore-state';
import { listCatalogueProducts } from '@/lib/catalogue/repository';

export const viewport: Viewport = {
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: { absolute: 'My JeloCare' },
  description: 'Private JeloCare workspace.',
  robots: { index: false, follow: false },
  openGraph: null,
  twitter: null,
};

export default async function MeLayout({ children }: { children: ReactNode }) {
  noStore();
  const products = await listCatalogueProducts();
  const basketProducts = products.map(({ slug, brand, name, image }) => ({
    slug,
    brand,
    name,
    image,
  }));

  return (
    <BasketProvider>
      <MeShelfStateProvider>
        <MeConcernStateProvider>
          <MeExploreStateProvider>{children}</MeExploreStateProvider>
        </MeConcernStateProvider>
      </MeShelfStateProvider>
      <PublicBasketPill products={basketProducts} surface="workspace" />
    </BasketProvider>
  );
}
