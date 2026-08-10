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
  const routineStepCount = viewModel.routines?.reduce(
    (total, routine) => total + routine.steps.length,
    0,
  ) ?? viewModel.routine.length;
  if (route.kind === 'home') {
    const concernCount = viewModel.concerns.length;
    const concernPart = concernCount > 0 ? ` · ${count(concernCount, 'concern')}` : '';
    const baseSummary = shelfAvailable ? `${shelfCount} · ${count(routineStepCount, 'step')}` : `Shelf unavailable · ${count(routineStepCount, 'step')}`;
    return {
      eyebrow: 'At a glance',
      title: `${shelfCount} · ${count(routineStepCount, 'step')}${concernPart}`,
      summary: `${baseSummary}${concernPart}`,
      items: [
        { id: 'shelf', label: 'My Shelf', detail: shelfAvailable ? count(viewModel.shelf.length, 'product') : 'Unavailable', href: '/me/shelf' },
        { id: 'routine', label: 'My Routine', detail: count(routineStepCount, 'step'), href: '/me/routine' },
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
        { id: 'routine', label: 'My Routine', detail: count(routineStepCount, 'step'), href: '/me/routine' },
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

  if (route.kind === 'shelf-add') {
    return {
      eyebrow: 'My Shelf · Private',
      title: 'Find it first',
      summary: 'Exact catalogue before private request',
      items: [
        { id: 'shelf', label: 'My Shelf', detail: shelfCount, href: '/me/shelf' },
        { id: 'explore', label: 'Explore products', detail: 'Exact catalogue', href: '/me/explore' },
      ],
    };
  }

  if (route.kind === 'shelf-request') {
    return {
      eyebrow: 'My Shelf · Private',
      title: 'Private request',
      summary: 'Original request and provenance',
      items: [
        { id: 'shelf', label: 'My Shelf', detail: shelfCount, href: '/me/shelf' },
        { id: 'request', label: 'Request another product', detail: 'Search exact catalogue first', href: '/me/shelf/add' },
      ],
    };
  }

  if (route.kind === 'routine') {
    const steps = viewModel.routines
      ? viewModel.routines.flatMap(routine => routine.steps).slice(0, 4).map(step => ({
          id: step.id,
          label: `${String(step.position).padStart(2, '0')} · ${step.label}`,
          detail: step.instruction || 'Saved step',
          href: step.product
            ? `/me/product/${step.product.slug}?from=routine`
            : '/me/routine',
        }))
      : viewModel.routine.slice(0, 4).map((step, index) => ({
          ...productItem(step.product, 'routine'),
          id: step.id,
          label: `${String(index + 1).padStart(2, '0')} · ${step.product.name}`,
          detail: `${step.moment} · ${step.product.brand}`,
        }));
    return {
      eyebrow: viewModel.routineProvenance ?? 'My Routine',
      title: 'My Routine',
      summary: count(routineStepCount, 'saved step'),
      items: steps.length ? steps : [
        { id: 'explore', label: 'Explore products', detail: 'Exact catalogue', href: '/me/explore' },
      ],
    };
  }

  if (route.kind === 'consult') {
    return {
      eyebrow: 'Ask Me',
      title: 'My care',
      summary: `${count(viewModel.concerns.length, 'saved concern')} · Session-only guide`,
      items: [
        { id: 'explore', label: 'Explore products', detail: 'Exact catalogue', href: '/me/explore' },
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
      { id: 'shelf', label: 'My Shelf', detail: shelfAvailable ? (onShelf ? 'Saved here' : 'My saved products') : 'Unavailable', href: '/me/shelf' },
      { id: 'routine', label: 'My Routine', detail: inRoutine ? 'Used here' : 'My saved steps', href: '/me/routine' },
    ] : [],
  };
}
