'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import type {
  CustomerPortalProduct,
  CustomerPortalShelfItem,
  CustomerPortalViewModel,
} from '@/lib/customer/portal-model';
import type { CustomerShelfActionResult } from '@/lib/customer/shelf-service';

export type PreviewShelfMutation =
  | { kind: 'add'; productSlug: string }
  | { kind: 'remove'; identityVersionId: string }
  | { kind: 'clear' };

export type ShelfActionHandler = (
  mutation: Exclude<PreviewShelfMutation, { kind: 'clear' }>,
) => CustomerShelfActionResult | Promise<CustomerShelfActionResult>;

type PreviewShelfState = {
  items: readonly CustomerPortalShelfItem[];
  result: CustomerShelfActionResult;
};

type MeShelfStateContextValue = {
  items: readonly CustomerPortalShelfItem[] | null;
  setItems: Dispatch<SetStateAction<readonly CustomerPortalShelfItem[] | null>>;
};

const MeShelfStateContext = createContext<MeShelfStateContextValue | null>(null);
const EMPTY_CATALOGUE: readonly CustomerPortalProduct[] = [];

function createPreviewShelfItem(
  product: CustomerPortalProduct,
  savedAt: string,
): CustomerPortalShelfItem {
  return {
    identityVersionId: `synthetic-development:${product.slug}`,
    savedAt,
    saveOrigin: 'synthetic-development',
    lifecycleState: 'active',
    availability: 'available',
    snapshot: {
      slug: product.slug,
      brand: product.brand,
      name: product.name,
      size: product.size,
      versionNumber: 1,
      packageVersion: 'synthetic-development',
      formulaVersion: 'synthetic-development',
    },
    product,
    message: null,
  };
}

export function reducePreviewShelf(
  items: readonly CustomerPortalShelfItem[],
  catalogue: readonly CustomerPortalProduct[],
  mutation: PreviewShelfMutation,
  savedAt = new Date().toISOString(),
): PreviewShelfState {
  if (mutation.kind === 'add') {
    if (items.some((item) => item.snapshot.slug === mutation.productSlug)) {
      return {
        items,
        result: { status: 'already_saved', message: 'Already on this preview Shelf.' },
      };
    }
    const product = catalogue.find((candidate) => candidate.slug === mutation.productSlug);
    if (!product) {
      return {
        items,
        result: { status: 'error', message: 'Product is unavailable in this preview.' },
      };
    }
    return {
      items: [createPreviewShelfItem(product, savedAt), ...items],
      result: { status: 'saved', message: 'Added for this preview.' },
    };
  }

  if (mutation.kind === 'remove') {
    const nextItems = items.filter((item) => item.identityVersionId !== mutation.identityVersionId);
    return nextItems.length === items.length
      ? {
          items,
          result: { status: 'already_removed', message: 'Already removed from this preview.' },
        }
      : {
          items: nextItems,
          result: { status: 'removed', message: 'Removed for this preview.' },
        };
  }

  const removed = items.length;
  return {
    items: [],
    result: {
      status: 'cleared',
      message: `Preview Shelf cleared. ${removed} product${removed === 1 ? '' : 's'} removed.`,
    },
  };
}

export function createPreviewShelfExport(
  items: readonly CustomerPortalShelfItem[],
  exportedAt = new Date().toISOString(),
) {
  return {
    format: 'jelocare-shelf-export-v1',
    scope: 'preview-only',
    resetsOnReload: true,
    exportedAt,
    items: items.map((item) => ({
      identityVersionId: item.identityVersionId,
      savedAt: item.savedAt,
      saveOrigin: item.saveOrigin,
      lifecycleState: item.lifecycleState,
      reviewedSnapshot: item.snapshot,
    })),
  } as const;
}

export function MeShelfStateProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<readonly CustomerPortalShelfItem[] | null>(null);
  const value = useMemo(() => ({ items, setItems }), [items]);
  return <MeShelfStateContext.Provider value={value}>{children}</MeShelfStateContext.Provider>;
}

export function useMeShelfState(viewModel: CustomerPortalViewModel) {
  const context = useContext(MeShelfStateContext);
  if (!context) throw new Error('JeloCare Me Shelf state requires MeShelfStateProvider.');

  const synthetic = viewModel.account.synthetic;
  const items = synthetic ? context.items ?? viewModel.shelf : viewModel.shelf;
  const catalogue = viewModel.catalogue ?? EMPTY_CATALOGUE;

  const portalViewModel = useMemo(() => synthetic
    ? { ...viewModel, shelf: items }
    : viewModel, [items, synthetic, viewModel]);

  const mutate = useCallback((mutation: PreviewShelfMutation) => {
    const next = reducePreviewShelf(items, catalogue, mutation);
    context.setItems(next.items);
    return next.result;
  }, [catalogue, context, items]);

  const shelfAction: ShelfActionHandler | undefined = synthetic
    ? (mutation) => mutate(mutation)
    : undefined;

  return {
    viewModel: portalViewModel,
    previewOnly: synthetic,
    shelfAction,
    clearPreviewShelf: synthetic ? () => mutate({ kind: 'clear' }) : undefined,
  };
}
