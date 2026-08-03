'use client';

import { useCallback, useState } from 'react';
import {
  INITIAL_WORKSPACE_DOCK_SCROLL_STATE,
  resolveAdaptiveWorkspaceDockMode,
  updateWorkspaceDockScrollState,
  type AdaptiveWorkspaceDockMode,
  type WorkspaceDockScrollState,
} from '@/lib/workspace-shell/dock-model';

type RouteDockState = {
  routeKey: string;
  scroll: WorkspaceDockScrollState;
  navigationRevealed: boolean;
};

export type AdaptiveWorkspaceDockController = {
  mode: AdaptiveWorkspaceDockMode;
  scroll: WorkspaceDockScrollState;
  navigationRevealed: boolean;
  onScrollPositionChange: (scrollTop: number) => void;
  revealNavigation: () => void;
  dismissNavigation: () => void;
};

export function useAdaptiveWorkspaceDockController({
  routeKey,
  hasNavigation,
  hasContext,
}: {
  routeKey: string;
  hasNavigation: boolean;
  hasContext: boolean;
}): AdaptiveWorkspaceDockController {
  const [state, setState] = useState<RouteDockState>(() => ({
    routeKey,
    scroll: INITIAL_WORKSPACE_DOCK_SCROLL_STATE,
    navigationRevealed: false,
  }));

  const effectiveState = state.routeKey === routeKey
    ? state
    : {
        routeKey,
        scroll: INITIAL_WORKSPACE_DOCK_SCROLL_STATE,
        navigationRevealed: false,
      };

  const onScrollPositionChange = useCallback((scrollTop: number) => {
    setState((current) => {
      const routeState = current.routeKey === routeKey
        ? current
        : {
            routeKey,
            scroll: INITIAL_WORKSPACE_DOCK_SCROLL_STATE,
            navigationRevealed: false,
          };
      const scroll = updateWorkspaceDockScrollState(routeState.scroll, scrollTop);
      return scroll === routeState.scroll ? routeState : { ...routeState, scroll };
    });
  }, [routeKey]);

  const revealNavigation = useCallback(() => {
    setState((current) => current.routeKey === routeKey
      ? { ...current, navigationRevealed: true }
      : current);
  }, [routeKey]);

  const dismissNavigation = useCallback(() => {
    setState((current) => current.routeKey === routeKey
      ? { ...current, navigationRevealed: false }
      : current);
  }, [routeKey]);

  return {
    mode: resolveAdaptiveWorkspaceDockMode({
      hasNavigation,
      hasContext,
      chromeHidden: effectiveState.scroll.chromeHidden,
      navigationRevealed: effectiveState.navigationRevealed,
    }),
    scroll: effectiveState.scroll,
    navigationRevealed: effectiveState.navigationRevealed,
    onScrollPositionChange,
    revealNavigation,
    dismissNavigation,
  };
}
