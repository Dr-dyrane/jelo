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
import type { CustomerPortalConcernReference, CustomerPortalViewModel } from '@/lib/customer/portal-model';
import type { CustomerConcernActionResult } from '@/lib/customer/concern-service';

type MeConcernStateContextValue = {
  concerns: readonly CustomerPortalConcernReference[] | null;
  setConcerns: Dispatch<SetStateAction<readonly CustomerPortalConcernReference[] | null>>;
};

const MeConcernStateContext = createContext<MeConcernStateContextValue | null>(null);

export function MeConcernStateProvider({ children }: { children: ReactNode }) {
  const [concerns, setConcerns] = useState<readonly CustomerPortalConcernReference[] | null>(null);
  const value = useMemo(() => ({ concerns, setConcerns }), [concerns]);
  return <MeConcernStateContext.Provider value={value}>{children}</MeConcernStateContext.Provider>;
}

export function useMeConcernState(viewModel: CustomerPortalViewModel) {
  const context = useContext(MeConcernStateContext);
  if (!context) throw new Error('JeloCare Me Concern state requires MeConcernStateProvider.');

  const synthetic = viewModel.account.synthetic;
  const concerns = synthetic ? context.concerns ?? viewModel.concerns : viewModel.concerns;

  const portalViewModel = useMemo(() => synthetic
    ? { ...viewModel, concerns }
    : viewModel, [concerns, synthetic, viewModel]);

  const addPreviewConcern = useCallback((slug: string, name: string, area: CustomerPortalConcernReference['area']): CustomerConcernActionResult => {
    if (concerns.some((c) => c.slug === slug)) {
      return { status: 'saved', concernSlug: slug, message: 'Already saved for this preview.' };
    }
    const next: CustomerPortalConcernReference = {
      slug,
      name,
      area,
      kind: 'concern' as const,
      source: 'synthetic-development' as const,
    };
    context.setConcerns([next, ...concerns]);
    return { status: 'saved', concernSlug: slug, message: 'Saved for this preview.' };
  }, [concerns, context]);

  const removePreviewConcern = useCallback((slug: string): CustomerConcernActionResult => {
    if (!concerns.some((c) => c.slug === slug)) {
      return { status: 'removed', concernSlug: slug, message: 'Already removed from this preview.' };
    }
    context.setConcerns(concerns.filter((c) => c.slug !== slug));
    return { status: 'removed', concernSlug: slug, message: 'Removed for this preview.' };
  }, [concerns, context]);

  const clearPreviewConcerns = useCallback((): CustomerConcernActionResult => {
    const count = concerns.length;
    context.setConcerns([]);
    return { status: 'cleared', message: `Preview concerns cleared. ${count} concern${count === 1 ? '' : 's'} removed.` };
  }, [concerns, context]);

  return {
    viewModel: portalViewModel,
    previewOnly: synthetic,
    addPreviewConcern: synthetic ? addPreviewConcern : undefined,
    removePreviewConcern: synthetic ? removePreviewConcern : undefined,
    clearPreviewConcerns: synthetic ? clearPreviewConcerns : undefined,
  };
}
