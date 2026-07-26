'use client';

import { useCallback, useOptimistic, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { queueSelectionHref } from '@/lib/moderation/queue-selection';

export function useUrlInboxSelection() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSelectionPending, startSelectionTransition] = useTransition();
  const routeSelectedId = searchParams.get('id');
  const [selectedId, setOptimisticSelectedId] = useOptimistic(
    routeSelectedId,
    (_currentId, nextId: string | null) => nextId,
  );

  const selectId = useCallback((nextId: string | null) => {
    if (nextId === selectedId) return;

    const href = queueSelectionHref(pathname, searchParams.toString(), nextId);
    startSelectionTransition(() => {
      setOptimisticSelectedId(nextId);
      router.replace(href, { scroll: false });
    });
  }, [pathname, router, searchParams, selectedId, setOptimisticSelectedId]);
  const onSelect = useCallback(
    (item: { id: string }) => selectId(item.id),
    [selectId],
  );
  const onDeselect = useCallback(() => selectId(null), [selectId]);

  return {
    selectedId,
    pendingSelectionId:
      isSelectionPending && selectedId !== routeSelectedId ? selectedId : null,
    onSelect,
    onDeselect,
  };
}
