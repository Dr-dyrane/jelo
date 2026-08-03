import type {
  CustomerPortalProduct,
  CustomerPortalShelfItem,
  CustomerPortalViewModel,
} from '@/lib/customer/portal-model';
import type { MePortalRoute } from './me-shell-model';

export type MeContextSheetItem = {
  id: string;
  label: string;
  detail: string;
  href: string;
};

export type MeContextSheetModel = {
  eyebrow: string;
  title: string;
  summary: string;
  items: readonly MeContextSheetItem[];
};

const count = (value: number, noun: string) => `${value} ${noun}${value === 1 ? '' : 's'}`;

function productItem(product: CustomerPortalProduct, source: 'shelf' | 'routine'): MeContextSheetItem {
  return {
    id: product.slug,
    label: product.name,
    detail: `${product.brand} · ${product.size}`,
    href: `/me/product/${product.slug}?from=${source}`,
  };
}

function shelfItem(item: CustomerPortalShelfItem): MeContextSheetItem {
  return {
    id: item.identityVersionId,
    label: item.snapshot.name,
    detail: item.product
      ? `${item.product.brand} · ${item.product.size}`
      : `${item.snapshot.brand} · ${item.availability === 'changed' ? 'Changed' : 'Unavailable'}`,
    href: item.product ? `/me/product/${item.product.slug}?from=shelf` : '/me/shelf',
  };
}

export function createMeContextSheetModel({
  route,
  viewModel,
  visibleProductCount,
  product,
}: {
  route: MePortalRoute;
  viewModel: CustomerPortalViewModel;
  visibleProductCount: number;
  product?: CustomerPortalProduct;
}): MeContextSheetModel {
  const shelfAvailable = viewModel.shelfState.status === 'ready';
  const shelfCount = shelfAvailable
    ? count(viewModel.shelf.length, 'saved product')
    : 'Shelf unavailable';
  if (route.kind === 'home') {
    return {
      eyebrow: 'At a glance',
      title: 'My care',
      summary: `${shelfCount} · ${count(viewModel.routine.length, 'step')}`,
      items: [
        { id: 'shelf', label: 'My Shelf', detail: shelfAvailable ? count(viewModel.shelf.length, 'product') : 'Unavailable', href: '/me/shelf' },
        { id: 'routine', label: 'My Routine', detail: count(viewModel.routine.length, 'step'), href: '/me/routine' },
      ],
    };
  }

  if (route.kind === 'explore') {
    return {
      eyebrow: 'Exact catalogue',
      title: 'My Explore',
      summary: count(visibleProductCount, 'product'),
      items: [
        { id: 'shelf', label: 'My Shelf', detail: shelfCount, href: '/me/shelf' },
        { id: 'routine', label: 'My Routine', detail: count(viewModel.routine.length, 'step'), href: '/me/routine' },
      ],
    };
  }

  if (route.kind === 'shelf') {
    if (!shelfAvailable) {
      return {
        eyebrow: 'My products',
        title: 'My Shelf',
        summary: 'Shelf unavailable',
        items: [
          { id: 'shelf-unavailable', label: 'My Shelf', detail: 'Try again', href: '/me/shelf' },
        ],
      };
    }
    const saved = viewModel.shelf.slice(0, 4).map(shelfItem);
    return {
      eyebrow: 'My products',
      title: 'My Shelf',
      summary: count(viewModel.shelf.length, 'saved product'),
      items: saved.length ? saved : [
        { id: 'explore', label: 'Explore products', detail: 'Exact catalogue', href: '/me/explore' },
      ],
    };
  }

  if (route.kind === 'routine') {
    const steps = viewModel.routine.slice(0, 4).map((step, index) => ({
      ...productItem(step.product, 'routine'),
      id: step.id,
      label: `${String(index + 1).padStart(2, '0')} · ${step.product.name}`,
      detail: `${step.moment} · ${step.product.brand}`,
    }));
    return {
      eyebrow: viewModel.routineProvenance ?? 'My Routine',
      title: 'My Routine',
      summary: count(viewModel.routine.length, 'saved step'),
      items: steps.length ? steps : [
        { id: 'explore', label: 'Explore products', detail: 'Exact catalogue', href: '/me/explore' },
      ],
    };
  }

  if (route.kind === 'consult') {
    return {
      eyebrow: 'Ask Me',
      title: 'My care',
      summary: `${count(viewModel.concerns.length, 'concern')} · ${count(visibleProductCount, 'match')}`,
      items: [
        { id: 'explore', label: 'Explore products', detail: count(visibleProductCount, 'match'), href: '/me/explore' },
        { id: 'shelf', label: 'My Shelf', detail: shelfCount, href: '/me/shelf' },
      ],
    };
  }

  if (route.kind === 'not-found') {
    return {
      eyebrow: 'JeloCare Me',
      title: 'Product not found',
      summary: 'Return to your exact catalogue',
      items: [
        { id: 'explore', label: 'Explore products', detail: 'Exact catalogue', href: '/me/explore' },
        { id: 'shelf', label: 'My Shelf', detail: shelfCount, href: '/me/shelf' },
      ],
    };
  }

  const onShelf = shelfAvailable && product
    ? viewModel.shelf.some((item) => item.product?.slug === product.slug)
    : false;
  const inRoutine = product ? viewModel.routine.some((step) => step.product.slug === product.slug) : false;
  return {
    eyebrow: 'My product',
    title: product?.name ?? 'Product',
    summary: `${shelfAvailable ? (onShelf ? 'On my Shelf' : 'Not on my Shelf') : 'Shelf unavailable'} · ${inRoutine ? 'In my Routine' : 'Not in my Routine'}`,
    items: product ? [
      { id: 'public', label: 'Public product evidence', detail: `${product.brand} · ${product.size}`, href: `/products/${product.slug}` },
      { id: 'shelf', label: 'My Shelf', detail: shelfAvailable ? (onShelf ? 'Saved here' : 'My saved products') : 'Unavailable', href: '/me/shelf' },
      { id: 'routine', label: 'My Routine', detail: inRoutine ? 'Used here' : 'My saved steps', href: '/me/routine' },
    ] : [],
  };
}
