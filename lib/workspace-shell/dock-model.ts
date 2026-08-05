// Behaviorally reviewed from My Finance revision 8f685bace2313ad9a4f50232fcb109509d5a99a8;
// implemented locally with neutral names and no runtime or repository coupling.
export const WORKSPACE_DOCK_GEOMETRY = {
  controlHeight: 58,
  contextHeight: 44,
  expandedHeight: 110,
  visualBottomClearance: 16,
  compactGutter: 12,
  islandGap: 10,
} as const;

export const WORKSPACE_DOCK_SCROLL_THRESHOLDS = {
  top: 12,
  direction: 6,
} as const;

export type AdaptiveWorkspaceDockMode =
  | 'expanded'
  | 'compact'
  | 'navigation'
  | 'single';

export type DockContextDescriptor = {
  id: string;
  label: string;
  detail: string;
  /** Shorter detail shown at ultra-narrow widths via CSS. The full
   * detail remains available to assistive technology through the
   * accessibleLabel. */
  compactDetail?: string;
  accessibleLabel?: string;
  onInvoke?: () => void;
  controls?: string;
  expanded?: boolean;
};

export type WorkspaceNavigationDescriptor = {
  id: string;
  label: string;
  href: string;
};

export type WorkspaceDockScrollState = {
  scrollTop: number;
  scrolled: boolean;
  chromeHidden: boolean;
  direction: 'up' | 'down' | 'idle';
  directionAnchor: number;
};

export const INITIAL_WORKSPACE_DOCK_SCROLL_STATE: WorkspaceDockScrollState = {
  scrollTop: 0,
  scrolled: false,
  chromeHidden: false,
  direction: 'idle',
  directionAnchor: 0,
};

export function resolveAdaptiveWorkspaceDockMode({
  hasNavigation,
  hasContext,
  chromeHidden,
  navigationRevealed,
}: {
  hasNavigation: boolean;
  hasContext: boolean;
  chromeHidden: boolean;
  navigationRevealed: boolean;
}): AdaptiveWorkspaceDockMode {
  if (!hasNavigation || !hasContext) return 'single';
  if (!chromeHidden) return 'expanded';
  return navigationRevealed ? 'navigation' : 'compact';
}

export function updateWorkspaceDockScrollState(
  previous: WorkspaceDockScrollState,
  nextScrollTop: number,
  thresholds = WORKSPACE_DOCK_SCROLL_THRESHOLDS,
): WorkspaceDockScrollState {
  const scrollTop = Number.isFinite(nextScrollTop)
    ? Math.max(0, nextScrollTop)
    : previous.scrollTop;
  const movement = scrollTop - previous.scrollTop;
  const direction = movement > 0 ? 'down' : movement < 0 ? 'up' : previous.direction;
  const directionChanged = direction !== previous.direction && movement !== 0;
  const directionAnchor = directionChanged ? previous.scrollTop : previous.directionAnchor;
  const directionalTravel = scrollTop - directionAnchor;
  const scrolled = scrollTop >= thresholds.top;
  let chromeHidden = previous.chromeHidden;
  let nextAnchor = directionAnchor;

  if (scrollTop <= thresholds.top) {
    chromeHidden = false;
    nextAnchor = scrollTop;
  } else if (direction === 'down' && directionalTravel > thresholds.direction) {
    chromeHidden = true;
    nextAnchor = scrollTop;
  } else if (direction === 'up' && directionalTravel < -thresholds.direction) {
    chromeHidden = false;
    nextAnchor = scrollTop;
  }

  return {
    scrollTop,
    scrolled,
    chromeHidden,
    direction: movement === 0 ? previous.direction : direction,
    directionAnchor: nextAnchor,
  };
}

function pathnameOnly(href: string) {
  const withoutHash = href.split('#', 1)[0] ?? '';
  const pathname = withoutHash.split('?', 1)[0] || '/';
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

export function resolveActiveWorkspaceNavigationItem<
  Item extends WorkspaceNavigationDescriptor,
>(items: readonly Item[], currentHref: string): Item | undefined {
  const currentPath = pathnameOnly(currentHref);
  return [...items]
    .filter((item) => {
      const itemPath = pathnameOnly(item.href);
      return currentPath === itemPath
        || (itemPath !== '/' && currentPath.startsWith(`${itemPath}/`));
    })
    .sort((left, right) => pathnameOnly(right.href).length - pathnameOnly(left.href).length)[0];
}
