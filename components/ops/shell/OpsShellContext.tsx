'use client';

import { createContext, useContext, useCallback, type ComponentType } from 'react';

export interface ContextFabConfig {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick: () => void;
}

export const ShellContext = createContext<{
  contextFab: ContextFabConfig | null;
  setContextFab: (fab: ContextFabConfig | null) => void;
}>({ contextFab: null, setContextFab: () => {} });

export function useContextFab() {
  const { setContextFab } = useContext(ShellContext);
  return useCallback((fab: ContextFabConfig | null) => setContextFab(fab), [setContextFab]);
}
