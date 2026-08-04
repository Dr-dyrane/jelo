import type {
  CustomerPortalConcernReference,
  CustomerPortalProduct,
  CustomerPortalRetailerPreference,
  CustomerPortalRoutineStep,
  CustomerPortalShelfItem,
} from './portal-model';

export type CustomerExploreFilterState = {
  search: string;
  category: string;
  step: string;
  brand: string;
  shelf: 'all' | 'on' | 'off';
  concernSlug: string;
  retailerName: string;
};

export const EMPTY_CUSTOMER_EXPLORE_FILTERS: CustomerExploreFilterState = {
  search: '',
  category: '',
  step: '',
  brand: '',
  shelf: 'all',
  concernSlug: '',
  retailerName: '',
};

export type CustomerExploreProduct = {
  product: CustomerPortalProduct;
  onShelf: boolean;
  inRoutine: boolean;
  matchedConcernSlugs: readonly string[];
  matchedRetailerNames: readonly string[];
};

export type CustomerExploreSection = {
  id: 'shelf' | 'routine' | 'concerns' | 'stores' | 'care-steps' | `category:${string}`;
  title: string;
  description: string;
  products: readonly CustomerExploreProduct[];
};

export type CustomerExploreProjection = {
  sections: readonly CustomerExploreSection[];
  eligibleCount: number;
};

export type CustomerExploreFilterOptions = {
  categories: readonly string[];
  steps: readonly string[];
  brands: readonly string[];
  concerns: readonly CustomerPortalConcernReference[];
  retailers: readonly string[];
};

type CustomerExploreInput = {
  catalogue: readonly CustomerPortalProduct[];
  shelf: readonly CustomerPortalShelfItem[];
  routine: readonly CustomerPortalRoutineStep[];
  concerns: readonly CustomerPortalConcernReference[];
  selectedRetailers: readonly CustomerPortalRetailerPreference[];
};

const CATEGORY_ORDER = ['Face', 'Body', 'Hair'] as const;
const normalize = (value: string) => value.trim().toLocaleLowerCase();

function uniqueBySlug(products: readonly CustomerPortalProduct[]) {
  const seen = new Set<string>();
  return products.filter((product) => {
    if (seen.has(product.slug)) return false;
    seen.add(product.slug);
    return true;
  });
}

function matchingNames(available: readonly string[], selected: readonly string[]) {
  const availableByKey = new Map(available.map(name => [normalize(name), name]));
  return selected.flatMap(name => {
    const match = availableByKey.get(normalize(name));
    return match ? [match] : [];
  });
}

function categoryRank(category: string) {
  const index = CATEGORY_ORDER.findIndex(candidate => candidate === category);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

function concernAreaMatchesProduct(
  concern: CustomerPortalConcernReference,
  product: CustomerPortalProduct,
) {
  const category = concern.area === 'Face'
    ? 'Face'
    : concern.area === 'Body'
      ? 'Body'
      : 'Hair';
  return product.category === category;
}

export function createCustomerExploreProjection({
  catalogue,
  shelf,
  routine,
  concerns,
  selectedRetailers,
}: CustomerExploreInput): CustomerExploreProjection {
  const eligibleProducts = uniqueBySlug(catalogue);
  const eligibleSlugs = new Set(eligibleProducts.map(product => product.slug));
  const shelfSlugs = new Set(shelf.flatMap(item => (
    item.lifecycleState === 'active'
    && item.availability === 'available'
    && item.product
    && eligibleSlugs.has(item.product.slug)
      ? [item.product.slug]
      : []
  )));
  const routineSlugs = new Set(routine.flatMap(step => (
    eligibleSlugs.has(step.product.slug) ? [step.product.slug] : []
  )));
  const supportedConcerns = concerns.filter(concern => concern.kind === 'concern');
  const supportedConcernBySlug = new Map(supportedConcerns.map(concern => [concern.slug, concern]));
  const chosenRetailerNames = selectedRetailers.map(preference => preference.name);
  const ownedProducts = eligibleProducts.filter(product => (
    shelfSlugs.has(product.slug) || routineSlugs.has(product.slug)
  ));
  const ownedCategorySteps = new Set(
    ownedProducts.map(product => `${normalize(product.category)}\u0000${normalize(product.step)}`),
  );

  const entries = eligibleProducts.map((product): CustomerExploreProduct => ({
    product,
    onShelf: shelfSlugs.has(product.slug),
    inRoutine: routineSlugs.has(product.slug),
    matchedConcernSlugs: product.supportedConcernSlugs.filter(slug => {
      const concern = supportedConcernBySlug.get(slug);
      return Boolean(concern && concernAreaMatchesProduct(concern, product));
    }),
    matchedRetailerNames: matchingNames(product.freshExactRetailerNames, chosenRetailerNames),
  }));
  let remaining = entries;
  const sections: CustomerExploreSection[] = [];

  const take = (
    id: CustomerExploreSection['id'],
    title: string,
    description: string,
    predicate: (entry: CustomerExploreProduct) => boolean,
  ) => {
    const products = remaining.filter(predicate);
    if (!products.length) return;
    const slugs = new Set(products.map(entry => entry.product.slug));
    remaining = remaining.filter(entry => !slugs.has(entry.product.slug));
    sections.push({ id, title, description, products });
  };

  take('shelf', 'On your Shelf', 'The exact products you already saved.', entry => entry.onShelf);
  take('routine', 'Your routine', 'Products in the routine steps you arranged.', entry => entry.inRoutine);
  take(
    'concerns',
    'For your concerns',
    'Products with reviewed support connected to concerns you chose.',
    entry => entry.matchedConcernSlugs.length > 0,
  );
  take(
    'stores',
    'From your stores',
    'Fresh exact listings from stores you explicitly chose.',
    entry => entry.matchedRetailerNames.length > 0,
  );
  take(
    'care-steps',
    'More in your care steps',
    'The same catalogue category and step as products you already saved.',
    entry => ownedCategorySteps.has(
      `${normalize(entry.product.category)}\u0000${normalize(entry.product.step)}`,
    ),
  );

  const categories = [...new Set(remaining.map(entry => entry.product.category))]
    .sort((left, right) => categoryRank(left) - categoryRank(right) || left.localeCompare(right));
  for (const category of categories) {
    take(
      `category:${normalize(category)}`,
      category,
      `All other ${category.toLocaleLowerCase()} products in the exact catalogue.`,
      entry => entry.product.category === category,
    );
  }

  return { sections, eligibleCount: eligibleProducts.length };
}

export function flattenCustomerExplore(
  projection: CustomerExploreProjection,
): readonly CustomerExploreProduct[] {
  return projection.sections.flatMap(section => section.products);
}

export function createCustomerExploreFilterOptions(
  projection: CustomerExploreProjection,
  concerns: readonly CustomerPortalConcernReference[],
): CustomerExploreFilterOptions {
  const products = flattenCustomerExplore(projection);
  const matchedConcernSlugs = new Set(products.flatMap(entry => entry.matchedConcernSlugs));
  const categories = [...new Set(products.map(entry => entry.product.category))]
    .sort((left, right) => categoryRank(left) - categoryRank(right) || left.localeCompare(right));
  return {
    categories,
    steps: [...new Set(products.map(entry => entry.product.step))].sort((left, right) => left.localeCompare(right)),
    brands: [...new Set(products.map(entry => entry.product.brand))].sort((left, right) => left.localeCompare(right)),
    concerns: concerns.filter(concern => (
      concern.kind === 'concern' && matchedConcernSlugs.has(concern.slug)
    )),
    retailers: [...new Set(products.flatMap(entry => entry.matchedRetailerNames))]
      .sort((left, right) => left.localeCompare(right)),
  };
}

export function filterCustomerExplore(
  projection: CustomerExploreProjection,
  filters: CustomerExploreFilterState,
): CustomerExploreProjection {
  const search = normalize(filters.search);
  const sections = projection.sections.flatMap(section => {
    const products = section.products.filter(entry => {
      const product = entry.product;
      if (search && !normalize([
        product.brand,
        product.name,
        product.category,
        product.step,
        product.size,
        product.displayLine,
      ].join(' ')).includes(search)) return false;
      if (filters.category && product.category !== filters.category) return false;
      if (filters.step && product.step !== filters.step) return false;
      if (filters.brand && product.brand !== filters.brand) return false;
      if (filters.shelf === 'on' && !entry.onShelf) return false;
      if (filters.shelf === 'off' && entry.onShelf) return false;
      if (filters.concernSlug && !entry.matchedConcernSlugs.includes(filters.concernSlug)) return false;
      if (filters.retailerName && !entry.matchedRetailerNames.includes(filters.retailerName)) return false;
      return true;
    });
    return products.length ? [{ ...section, products }] : [];
  });
  return { sections, eligibleCount: projection.eligibleCount };
}

export function clearCustomerExploreFilters(): CustomerExploreFilterState {
  return { ...EMPTY_CUSTOMER_EXPLORE_FILTERS };
}

export function countCustomerExploreFilters(filters: CustomerExploreFilterState) {
  return [
    filters.search,
    filters.category,
    filters.step,
    filters.brand,
    filters.shelf === 'all' ? '' : filters.shelf,
    filters.concernSlug,
    filters.retailerName,
  ].filter(Boolean).length;
}
