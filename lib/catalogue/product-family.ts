import {
  catalogueProductFamilies,
  type CatalogueProductFamily,
  type CatalogueProductPackageForm,
} from '@/data/product-families';

export type CatalogueFamilyProduct = {
  slug: string;
  size: string;
  image: string;
  offers: readonly unknown[];
};

export type ResolvedCatalogueProductFamilyMember<T extends CatalogueFamilyProduct> = {
  product: T;
  packageForm: CatalogueProductPackageForm;
  optionLabel: string;
};

export type ResolvedCatalogueProductFamily<T extends CatalogueFamilyProduct> = {
  id: string;
  current: ResolvedCatalogueProductFamilyMember<T>;
  members: ResolvedCatalogueProductFamilyMember<T>[];
};

function normalizedSize(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function catalogueSizeLabel(value: string) {
  return value
    .trim()
    .replace(/\bml\b/gi, 'mL');
}

function optionLabel(
  size: string,
  packageForm: CatalogueProductPackageForm,
  members: readonly { product: CatalogueFamilyProduct; packageForm: CatalogueProductPackageForm }[],
) {
  const sameSizeHasAnotherForm = members.some(member => (
    normalizedSize(member.product.size) === normalizedSize(size)
    && member.packageForm !== packageForm
  ));
  const displaySize = catalogueSizeLabel(size);
  if (packageForm === 'refill' || sameSizeHasAnotherForm) {
    return `${displaySize} ${packageForm}`;
  }
  return displaySize;
}

/**
 * Resolves a family only through the supplied public catalogue projection.
 * Missing, duplicate, or ambiguous memberships fail closed rather than
 * exposing a private candidate or borrowing another SKU's product data.
 */
export function resolveCatalogueProductFamily<T extends CatalogueFamilyProduct>(
  currentSlug: string,
  publicProducts: readonly T[],
  families: readonly CatalogueProductFamily[] = catalogueProductFamilies,
): ResolvedCatalogueProductFamily<T> | null {
  const matchingFamilies = families.filter(family => (
    family.members.some(member => member.productSlug === currentSlug)
  ));
  if (matchingFamilies.length !== 1) return null;
  const [family] = matchingFamilies;

  const productsBySlug = new Map<string, T>();
  for (const product of publicProducts) {
    if (productsBySlug.has(product.slug)) return null;
    productsBySlug.set(product.slug, product);
  }

  const seenMemberSlugs = new Set<string>();
  const resolvedMembers: Array<{
    product: T;
    packageForm: CatalogueProductPackageForm;
  }> = [];
  for (const member of family.members) {
    if (seenMemberSlugs.has(member.productSlug)) return null;
    seenMemberSlugs.add(member.productSlug);
    const product = productsBySlug.get(member.productSlug);
    if (product) resolvedMembers.push({ product, packageForm: member.packageForm });
  }

  const current = resolvedMembers.find(member => member.product.slug === currentSlug);
  if (!current) return null;
  const members = resolvedMembers.map(member => ({
    ...member,
    optionLabel: optionLabel(member.product.size, member.packageForm, resolvedMembers),
  }));
  const resolvedCurrent = members.find(member => member.product.slug === currentSlug);
  if (!resolvedCurrent) return null;

  return {
    id: family.id,
    current: resolvedCurrent,
    members,
  };
}
