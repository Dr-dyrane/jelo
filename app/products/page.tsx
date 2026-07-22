import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { SafeEditorialImage } from '@/components/editorial/safe-editorial-image';
import { CatalogueSearch } from '@/components/products/catalogue-search';
import type { CatalogueSearchSuggestion } from '@/components/products/catalogue-search-suggestions';
import { InventoryCard } from '@/components/products/inventory-card';
import { CatalogueTransitionTracker } from '@/components/products/catalogue-transition-tracker';
import { CatalogueFilterFeedback } from '@/components/products/filter-feedback-actions';
import { InventoryFilterSheet } from '@/components/products/inventory-filter-sheet';
import { InventoryPagination } from '@/components/products/inventory-pagination';
import { ProductRail } from '@/components/products/product-grid';
import { editorialAsset } from '@/data/editorial';
import { externalProducts } from '@/data/external-catalogue';
import { concerns } from '@/data/knowledge';
import type { Market } from '@/data/prices';
import type { ReviewedProduct } from '@/data/products';
import { matchingCatalogueConcerns } from '@/lib/catalogue/catalogue-interactions';
import { queryInventory } from '@/lib/catalogue/inventory-repository';
import { listCatalogueProducts, listRecommendationEligibleProducts } from '@/lib/catalogue/repository';
import { hasVerifiedNigeriaOffer } from '@/modules/commerce/home-merchandising';
import { productMatchesConcern } from '@/modules/concerns/product-matching';
import styles from './products.module.css';
import feedbackStyles from './catalogue-feedback.module.css';

export const revalidate = 3600;
export const metadata = { title: 'Products', alternates: { canonical: '/products' } };

type SearchParams = Record<string, string | string[] | undefined>;

const heroAsset = editorialAsset('catalogue-hero');
const allSkinAsset = editorialAsset('catalogue-all-skin-story');
const scalpAsset = editorialAsset('catalogue-scalp-story');
const ageAsset = editorialAsset('catalogue-age-story');

function value(params: SearchParams, key: string) {
  const current = params[key];
  return Array.isArray(current) ? current[0] ?? '' : current ?? '';
}

function queryFrom(params: SearchParams) {
  const query = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    const current = Array.isArray(raw) ? raw[0] : raw;
    if (current) query.set(key, current);
  }
  return query;
}

function href(params: SearchParams, updates: Record<string, string | null>, anchor = '') {
  const query = queryFrom(params);
  query.delete('page');
  for (const [key, next] of Object.entries(updates)) {
    if (next) query.set(key, next);
    else query.delete(key);
  }
  const suffix = query.toString();
  const base = suffix ? `/products?${suffix}` : '/products';
  return anchor ? `${base}#${anchor}` : base;
}

function inventoryShortcutHref(market: Market, key: 'brand' | 'category', value: string) {
  const query = new URLSearchParams({ [key]: value });
  if (market === 'US') query.set('market', 'US');
  return `/products?${query.toString()}#all-products`;
}

function inventoryCategory(product: ReviewedProduct) {
  if (product.category === 'Hair') return 'Hair & scalp';
  if (product.category === 'Body') return 'Body care';
  return 'Face care';
}

function DiscoveryRail({ eyebrow, title, products, market, href: railHref }: { eyebrow: string; title: string; products: ReviewedProduct[]; market: Market; href: string }) {
  if (!products.length) return null;
  return <section className={styles.shelf}>
    <div className={styles.sectionHeading}><div><p>{eyebrow}</p><h2>{title}</h2></div><Link href={railHref}>View all <ArrowRight size={16} aria-hidden="true"/></Link></div>
    <ProductRail products={products.slice(0, 12)} market={market}/>
  </section>;
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const market: Market = value(params, 'market') === 'US' ? 'US' : 'NG';
  const browse = ['concern', 'category'].includes(value(params, 'browse')) ? value(params, 'browse') : 'category';
  const [result, reviewedProducts, supportiveProducts] = await Promise.all([
    queryInventory({
      q: value(params, 'q'),
      category: value(params, 'category'),
      review: value(params, 'review'),
      sort: value(params, 'sort'),
      concern: value(params, 'concern'),
      step: value(params, 'step'),
      brand: value(params, 'brand'),
      availability: value(params, 'availability'),
      price: value(params, 'price'),
      market,
      page: value(params, 'page'),
    }),
    listCatalogueProducts(),
    listRecommendationEligibleProducts(),
  ]);
  const nigeriaReady = reviewedProducts.filter(hasVerifiedNigeriaOffer);
  const faceCare = reviewedProducts.filter(product => product.category === 'Face');
  const hairAndScalp = reviewedProducts.filter(product => product.category === 'Hair');
  const approvedConcerns = concerns.filter(concern => supportiveProducts.some(product => productMatchesConcern(product, concern)));
  const publicSearchRecords = [
    ...reviewedProducts.map(product => ({ brand: product.brand, category: inventoryCategory(product) })),
    ...externalProducts.map(product => ({ brand: product.brand, category: product.category })),
  ];
  const companyIndex = new Map<string, { label: string; count: number }>();
  const categoryIndex = new Map<string, number>();
  for (const record of publicSearchRecords) {
    const companyKey = record.brand.toLocaleLowerCase();
    const company = companyIndex.get(companyKey);
    if (company) company.count += 1;
    else companyIndex.set(companyKey, { label: record.brand, count: 1 });
    categoryIndex.set(record.category, (categoryIndex.get(record.category) ?? 0) + 1);
  }
  const searchSuggestions: CatalogueSearchSuggestion[] = [
    ...[...categoryIndex.entries()]
      .filter(([, count]) => count > 0)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([label, count]) => ({
        kind: 'category' as const,
        label,
        detail: `${count} ${count === 1 ? 'product' : 'products'}`,
        href: inventoryShortcutHref(market, 'category', label),
      })),
    ...approvedConcerns.slice(0, 6).map(concern => ({
      kind: 'guide' as const,
      label: concern.name,
      detail: 'Concern guide',
      href: `/concerns/${concern.slug}`,
      keywords: concern.productTerms,
    })),
    ...[...companyIndex.values()]
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
      .slice(0, 40)
      .map(company => ({
        kind: 'company' as const,
        label: company.label,
        detail: `${company.count} ${company.count === 1 ? 'product' : 'products'}`,
        href: inventoryShortcutHref(market, 'brand', company.label),
      })),
    ...reviewedProducts.slice(0, 24).map(product => ({
      kind: 'product' as const,
      label: product.name,
      detail: product.brand,
      href: `/products/${product.slug}`,
      keywords: [product.size],
    })),
  ];
  const paginationParams = queryFrom(params);
  const currentSuffix = paginationParams.toString();
  const currentHref = currentSuffix ? `/products?${currentSuffix}` : '/products';
  const clearHref = market === 'US' ? '/products?market=US#all-products' : '/products#all-products';
  const priceLabels = market === 'NG'
    ? { low: 'Under ₦10k', mid: '₦10k–₦25k', high: '₦25k+' }
    : { low: 'Under $15', mid: '$15–$35', high: '$35+' };
  const concernName = concerns.find(concern => concern.slug === result.filters.concern)?.name;
  const appliedFilters = [
    result.filters.q ? { key: 'q', label: `“${result.filters.q}”` } : null,
    result.filters.category !== 'All' ? { key: 'category', label: result.filters.category } : null,
    result.filters.review !== 'all' ? { key: 'review', label: result.filters.review === 'supportive' ? 'Supportive use' : result.filters.review === 'reviewed' ? 'JeloCare profiles' : 'Community data' } : null,
    result.filters.brand ? { key: 'brand', label: result.filters.brand } : null,
    concernName ? { key: 'concern', label: concernName } : null,
    result.filters.step ? { key: 'step', label: result.filters.step } : null,
    result.filters.availability === 'priced' ? { key: 'availability', label: 'Fresh price' } : null,
    result.filters.price !== 'all' ? { key: 'price', label: priceLabels[result.filters.price] } : null,
    result.filters.sort !== 'featured' ? { key: 'sort', label: result.filters.sort === 'name' ? 'Name order' : 'Recently updated' } : null,
  ].filter((filter): filter is { key: string; label: string } => Boolean(filter));
  const linkedFilters = appliedFilters.map(filter => ({ ...filter, href: href(params, { [filter.key]: null }, 'all-products') }));
  const concernGuides = matchingCatalogueConcerns(concerns, result.filters.q);
  const hasActiveIntent = appliedFilters.length > 0 || result.page > 1 || market === 'US';

  return <main className={styles.page}>
    <CatalogueTransitionTracker currentHref={currentHref}/>
    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <p className={styles.kicker}>The catalogue</p>
        <h1>Browse the shelf.</h1>
      </div>
      <div className={styles.heroImage}><SafeEditorialImage asset={heroAsset} alt={heroAsset.altText} priority sizes="(max-width: 760px) 100vw, 58vw"/></div>
    </section>

    <CatalogueSearch key={`${market}:${result.filters.q}`} defaultValue={result.filters.q} market={market} suggestions={searchSuggestions}/>

    {!hasActiveIntent ? <><section className={styles.browse} id="browse">
      <div className={styles.sectionHeading}>
        <div><p className={styles.kicker}>Browse</p><h2>Your way.</h2></div>
        <div className={styles.browseTabs} aria-label="Browse catalogue by">
          {(['category', 'concern'] as const).map(mode => <Link aria-current={browse === mode ? 'page' : undefined} className={browse === mode ? styles.active : ''} href={href(params, { browse: mode, category: null, concern: null, step: null }, 'browse')} key={mode}>{mode}</Link>)}
        </div>
      </div>
      <div className={styles.browseRail}>
        {browse === 'category' ? result.facets.categories.filter(({ count }) => count > 0).map(({ value: category, count }) => <Link className={result.filters.category === category ? styles.selected : ''} href={href(params, { category: result.filters.category === category ? null : category, concern: null, step: null }, 'all-products')} key={category}><span>{category}</span><small>{count} {count === 1 ? 'product' : 'products'}</small></Link>) : null}
        {browse === 'concern' ? approvedConcerns.map(concern => <Link className={result.filters.concern === concern.slug ? styles.selected : ''} href={href(params, { concern: result.filters.concern === concern.slug ? null : concern.slug, category: null, step: null, review: 'supportive' }, 'all-products')} key={concern.slug}><span>{concern.name}</span><small>{concern.area}</small></Link>) : null}
      </div>
      {browse === 'concern' ? <p className={styles.reviewNote}>Only approved supportive uses appear here.</p> : null}
    </section>

    <section className={styles.stories} aria-label="Care stories">
      <article><div className={styles.storyImage}><SafeEditorialImage asset={allSkinAsset} alt={allSkinAsset.altText} sizes="(max-width: 760px) 100vw, 33vw"/></div><div className={styles.storyCopy}><p>Every skin</p><h2>No one palette.</h2><Link href="/concerns">Explore concerns <ArrowRight size={15} aria-hidden="true"/></Link></div></article>
      <article><div className={styles.storyImage}><SafeEditorialImage asset={scalpAsset} alt={scalpAsset.altText} sizes="(max-width: 760px) 100vw, 33vw"/></div><div className={styles.storyCopy}><p>Hair & scalp</p><h2>Start at the root.</h2><Link href="/concerns/dandruff-itchy-scalp">Read the scalp guide <ArrowRight size={15} aria-hidden="true"/></Link></div></article>
      <article><div className={styles.storyImage}><SafeEditorialImage asset={ageAsset} alt={ageAsset.altText} sizes="(max-width: 760px) 100vw, 33vw"/></div><div className={styles.storyCopy}><p>Simple care</p><h2>Made for change.</h2><Link href="/consult">Ask JeloCare <ArrowRight size={15} aria-hidden="true"/></Link></div></article>
    </section>

    <DiscoveryRail eyebrow="Observed in Nigeria" title="Prices seen here." products={nigeriaReady} market={market} href={href(params, { review: 'reviewed' })}/>
    <DiscoveryRail eyebrow="Supportive use" title="Supportive care." products={supportiveProducts} market={market} href={href(params, { review: 'supportive' })}/>
    <DiscoveryRail eyebrow="Face care" title="Browse the category." products={faceCare} market={market} href={href(params, { review: 'reviewed', category: 'Face care', browse: 'category' })}/>
    <DiscoveryRail eyebrow="Hair & scalp" title="Browse the category." products={hairAndScalp} market={market} href={href(params, { review: 'reviewed', category: 'Hair & scalp', browse: 'category' })}/></> : null}

    <section className={`${styles.catalogue} ${feedbackStyles.catalogueState} ${appliedFilters.length ? feedbackStyles.filtered : ''}`} id="all-products">
      {concernGuides.length ? <aside className={styles.concernGuide} aria-label="Concern guidance">
        <div className={styles.concernGuideHeading}><p className={styles.kicker}>Concern guidance</p><span>Not a diagnosis.</span></div>
        <div className={styles.concernGuideRail}>{concernGuides.map(concern => <Link href={`/concerns/${concern.slug}`} key={concern.slug}><span>{concern.name}</span><small>{concern.summary}</small><ArrowRight size={15} aria-hidden="true"/></Link>)}</div>
      </aside> : null}
      <div className={styles.catalogueHeading}>
        <div><p className={styles.kicker}>All products</p><h2 id="catalogue-results-heading" tabIndex={-1}>{result.total.toLocaleString()} found.</h2></div>
        <InventoryFilterSheet filters={result.filters} facets={result.facets} market={market} browse={browse} total={result.total}/>
      </div>
      <CatalogueFilterFeedback appliedFilters={linkedFilters} clearHref={clearHref} currentHref={currentHref} total={result.total}/>
      {result.items.length ? <div className={styles.grid}>{result.items.map(item => <InventoryCard item={item} market={market} key={item.id}/>)}</div> : <div className={styles.empty}><h3>Nothing exact.</h3><p>Try fewer filters.</p><Link href="/products">Show all products</Link></div>}
      <InventoryPagination page={result.page} pageCount={result.pageCount} params={paginationParams}/>
    </section>

    <aside className={styles.sourceNote}>
      <div><p className={styles.kicker}>{externalProducts.length ? 'Two catalogue sources' : 'Catalogue context'}</p><h2>Know what you see.</h2></div>
      <div>
        <p>Profiles show products and prices.</p>
        <p>Supportive use adds a care review.</p>
        {externalProducts.length ? <a href="https://world.openbeautyfacts.org/data" target="_blank" rel="noreferrer">Open Beauty Facts · ODbL / CC BY-SA <ArrowRight size={15} aria-hidden="true"/></a> : null}
      </div>
    </aside>
  </main>;
}
