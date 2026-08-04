import type { Metadata } from 'next';
import { ContributionExperience } from '@/components/contribute/contribution-experience';
import { ContributionTrustSignals } from '@/components/contribute/contribution-trust-signals';
import { SafeEditorialImage } from '@/components/editorial/safe-editorial-image';
import type { AdaptiveOption } from '@/components/ui/adaptive-selector';
import { editorialAsset } from '@/data/editorial';
import { nigeriaRetailers } from '@/data/retailers';
import { listCatalogueProducts } from '@/lib/catalogue/repository';
import {
  communityOptionId,
  communityPurposeOptions,
} from '@/lib/community-intake/canonical-options';
import { catalogueSearchProductPrefill } from '@/lib/community-intake/catalogue-search-handoff';
import { publicSocialMetadata, staticSocialCard } from '@/lib/og/social-card';
import styles from './contribute.module.css';

export const revalidate = 3600;

export const metadata: Metadata = publicSocialMetadata(staticSocialCard('contribute'), '/contribute');

const heroAsset = editorialAsset('morning-care-lagos');

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ContributePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const initialProduct = catalogueSearchProductPrefill(params);
  const catalogue = await listCatalogueProducts();
  const products: AdaptiveOption[] = catalogue.map(product => ({
    id: `product:${product.slug}`,
    label: product.name,
    detail: product.brand,
    aliases: [product.size, product.displayLine],
  }));
  const brandNames = [...new Set(catalogue.map(product => product.brand))].sort((left, right) => left.localeCompare(right));
  const brands: AdaptiveOption[] = brandNames.map(brand => ({ id: communityOptionId('brand', brand), label: brand }));
  const retailers: AdaptiveOption[] = nigeriaRetailers.map(retailer => ({
    id: communityOptionId('retailer', retailer.name),
    label: retailer.name,
    detail: retailer.kind === 'marketplace' ? 'Marketplace' : 'Nigeria',
  }));
  const purposes: AdaptiveOption[] = communityPurposeOptions.map(option => ({ ...option }));

  return <main className={styles.page}>
    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <p>Community library</p>
        <h1>Tell us about one product.</h1>
        <span>Share what you use. No account.</span>
        <ContributionTrustSignals />
      </div>
      <div className={styles.heroImage}>
        <SafeEditorialImage asset={heroAsset} alt={heroAsset.altText} priority sizes="(max-width: 760px) 100vw, 44vw" />
      </div>
    </section>

    <ContributionExperience
      key={initialProduct ? `catalogue-search:${initialProduct.label}` : 'direct'}
      purposes={purposes}
      products={products}
      brands={brands}
      retailers={retailers}
      initialProduct={initialProduct}
    />

    <section className={styles.boundary}>
      <p>Built together.</p>
      <h2>One note can help someone choose.</h2>
    </section>
  </main>;
}
