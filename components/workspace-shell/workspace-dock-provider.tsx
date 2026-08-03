'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  createDockFabRegistry,
  registerDockFab,
  resolveDockFab,
  unregisterDockFab,
} from '@/lib/workspace-shell/fab-registry';

export type WorkspaceDockFabDescriptor = {
  ownerId: string;
  routeKey: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  busy?: boolean;
  onInvoke: () => void;
};

type WorkspaceDockContextValue = {
  routeKey: string;
  activeFab?: WorkspaceDockFabDescriptor;
  registerFab: (registration: WorkspaceDockFabDescriptor) => () => void;
};

const WorkspaceDockContext = createContext<WorkspaceDockContextValue | null>(null);

export function WorkspaceDockProvider({
  routeKey,
  children,
}: {
  routeKey: string;
  children: ReactNode;
}) {
  const tokenSequence = useRef(0);
  const [registry, setRegistry] = useState(() =>
    createDockFabRegistry<WorkspaceDockFabDescriptor>(routeKey));

  const registerFab = useCallback((registration: WorkspaceDockFabDescriptor) => {
    tokenSequence.current += 1;
    const token = `${registration.ownerId}:${tokenSequence.current}`;
    setRegistry((current) => {
      const routeRegistry = current.routeKey === routeKey
        ? current
        : createDockFabRegistry<WorkspaceDockFabDescriptor>(routeKey);
      return registerDockFab(routeRegistry, {
        ownerId: registration.ownerId,
        routeKey: registration.routeKey,
        value: registration,
      }, token);
    });
    return () => setRegistry((current) => unregisterDockFab(current, token));
  }, [routeKey]);

  const activeFab = registry.routeKey === routeKey
    ? resolveDockFab(registry)?.value
    : undefined;
  const value = useMemo(() => ({ routeKey, activeFab, registerFab }), [
    routeKey,
    activeFab,
    registerFab,
  ]);

  return (
    <WorkspaceDockContext.Provider value={value}>
      {children}
    </WorkspaceDockContext.Provider>
  );
}

function useWorkspaceDockContext() {
  const value = useContext(WorkspaceDockContext);
  if (!value) throw new Error('Workspace dock hooks require WorkspaceDockProvider.');
  return value;
}

export function useWorkspaceDockFab() {
  return useWorkspaceDockContext().activeFab;
}

export function useWorkspaceDockFabRegistration(
  registration: WorkspaceDockFabDescriptor | null,
) {
  const { routeKey, registerFab } = useWorkspaceDockContext();
  const onInvokeRef = useRef(registration?.onInvoke);
  useEffect(() => {
    onInvokeRef.current = registration?.onInvoke;
  }, [registration?.onInvoke]);
  const ownerId = registration?.ownerId;
  const registrationRouteKey = registration?.routeKey;
  const label = registration?.label;
  const icon = registration?.icon;
  const disabled = registration?.disabled;
  const busy = registration?.busy;
  const stableRegistration = useMemo<WorkspaceDockFabDescriptor | null>(() => {
    if (!ownerId || !registrationRouteKey || !label || !icon) return null;
    return {
      ownerId,
      routeKey: registrationRouteKey,
      label,
      icon,
      disabled,
      busy,
      onInvoke: () => onInvokeRef.current?.(),
    };
  }, [ownerId, registrationRouteKey, label, icon, disabled, busy]);

  useEffect(() => {
    if (!stableRegistration || stableRegistration.routeKey !== routeKey) return;
    return registerFab(stableRegistration);
  }, [stableRegistration, registerFab, routeKey]);
}
