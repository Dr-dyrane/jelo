'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import {
  clearCustomerExploreFilters,
  type CustomerExploreFilterState,
} from '@/lib/customer/explore-model';

type MeExploreStateContextValue = {
  filters: CustomerExploreFilterState;
  setFilters: Dispatch<SetStateAction<CustomerExploreFilterState>>;
  getScrollPosition: () => number;
  setScrollPosition: (position: number) => void;
};

const MeExploreStateContext = createContext<MeExploreStateContextValue | null>(null);

export function MeExploreStateProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<CustomerExploreFilterState>(clearCustomerExploreFilters);
  const scrollPositionRef = useRef(0);
  const getScrollPosition = useCallback(() => scrollPositionRef.current, []);
  const setScrollPosition = useCallback((position: number) => {
    scrollPositionRef.current = position;
  }, []);
  const value = useMemo(() => ({
    filters,
    setFilters,
    getScrollPosition,
    setScrollPosition,
  }), [filters, getScrollPosition, setScrollPosition]);

  return <MeExploreStateContext.Provider value={value}>{children}</MeExploreStateContext.Provider>;
}

export function useMeExploreState() {
  const context = useContext(MeExploreStateContext);
  if (!context) throw new Error('JeloCare Explore state requires MeExploreStateProvider.');
  return context;
}
