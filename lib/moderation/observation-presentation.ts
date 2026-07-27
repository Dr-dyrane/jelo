import type { Product } from '@/data/products';
import { money } from '@/lib/format/money';
import { humanizeRef, resolveProductRef } from '@/lib/humanize/refs';
import { outcomeLabel } from '@/lib/humanize/outcomes';
import type { PendingObservation } from './queues';

export type ObservationIdentityState =
  | 'resolved_product'
  | 'unresolved_product'
  | 'non_product';

export type ObservationReviewItem = PendingObservation & {
  title: string;
  summary: string;
  identity: {
    state: ObservationIdentityState;
    image: string | null;
    detail: string;
  };
};

export function observationProductSlug(
  row: Pick<PendingObservation, 'subjectKind' | 'subjectRef'>,
) {
  if (row.subjectKind !== 'product') return null;
  const slug = row.subjectRef.startsWith('product:')
    ? row.subjectRef.slice('product:'.length)
    : row.subjectRef;
  return slug.trim() || null;
}

function titleWithBrand(name: string, brand: string | undefined) {
  if (!brand) return name;
  const normalizedName = name.toLocaleLowerCase('en-NG');
  return normalizedName.includes(brand.toLocaleLowerCase('en-NG'))
    ? name
    : `${brand} ${name}`;
}

function observationSummary(row: PendingObservation) {
  if (row.kind === 'price') return money(row.amountNgn);
  if (row.outcome) return outcomeLabel(row.outcome);
  return 'Community report';
}

export function observationReviewItem(
  row: PendingObservation,
  product?: Product,
): ObservationReviewItem {
  const slug = observationProductSlug(row);
  const exactProduct = slug && product?.slug === slug ? product : undefined;
  const checkedInProduct = slug ? resolveProductRef(slug) : null;
  const resolvedProduct = exactProduct ?? (
    checkedInProduct?.displayApproved
      ? {
          slug: checkedInProduct.slug,
          brand: checkedInProduct.brand,
          name: checkedInProduct.name,
          image: checkedInProduct.image!,
          category: null,
          size: null,
        }
      : undefined
  );

  if (slug && resolvedProduct) {
    return {
      ...row,
      title: titleWithBrand(resolvedProduct.name, resolvedProduct.brand),
      summary: observationSummary(row),
      identity: {
        state: 'resolved_product',
        image: resolvedProduct.image,
        detail: exactProduct
          ? `${exactProduct.category} · ${exactProduct.size}`
          : 'Catalogue product',
      },
    };
  }

  const subject = humanizeRef(row.subjectRef);
  return {
    ...row,
    title: titleWithBrand(subject.name, subject.brand),
    summary: observationSummary(row),
    identity: {
      state: slug ? 'unresolved_product' : 'non_product',
      image: null,
      detail: slug ? 'Product needs matching' : 'Community report',
    },
  };
}
