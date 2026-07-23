import type { Metadata } from 'next';
import { ContributionExperience } from '@/components/contribute/contribution-experience';
import { ContributionTrustSignals } from '@/components/contribute/contribution-trust-signals';
import { SafeEditorialImage } from '@/components/editorial/safe-editorial-image';
import type { AdaptiveOption } from '@/components/ui/adaptive-selector';
import { concerns } from '@/data/knowledge';
import { editorialAsset } from '@/data/editorial';
import { nigeriaRetailers } from '@/data/retailers';
import { listCatalogueProducts } from '@/lib/catalogue/repository';
import styles from './contribute.module.css';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Share skincare',
  description: 'Tell us about one product. Anonymous and usually under a minute.',
  alternates: { canonical: '/contribute' },
};

const heroAsset = editorialAsset('morning-care-lagos');

function optionId(prefix: string, value: string) {
  return `${prefix}:${value.normalize('NFKD').toLocaleLowerCase('en-NG').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

export default async function ContributePage() {
  const catalogue = await listCatalogueProducts();
  const products: AdaptiveOption[] = catalogue.map(product => ({
    id: `product:${product.slug}`,
    label: product.name,
    detail: product.brand,
    aliases: [product.size, product.displayLine],
  }));
  const brandNames = [...new Set(catalogue.map(product => product.brand))].sort((left, right) => left.localeCompare(right));
  const brands: AdaptiveOption[] = brandNames.map(brand => ({ id: optionId('brand', brand), label: brand }));
  const retailers: AdaptiveOption[] = nigeriaRetailers.map(retailer => ({
    id: optionId('retailer', retailer.name),
    label: retailer.name,
    detail: retailer.kind === 'marketplace' ? 'Marketplace' : 'Nigeria',
  }));
  const purposeLabels = [
    'Acne', 'Dark spots', 'Oily skin', 'Dry skin', 'Normal skin', 'Sensitive skin', 'Hair', 'Body',
  ];
  const concernAliases = new Map(concerns.map(concern => [concern.name.toLocaleLowerCase('en-NG'), concern.signals]));
  const purposes: AdaptiveOption[] = purposeLabels.map(label => ({
    id: optionId('purpose', label),
    label,
    aliases: concernAliases.get(label.toLocaleLowerCase('en-NG')),
  }));

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

    <ContributionExperience purposes={purposes} products={products} brands={brands} retailers={retailers}/>

    <section className={styles.boundary}>
      <p>Built together.</p>
      <h2>One note can help someone choose.</h2>
    </section>
  </main>;
}
