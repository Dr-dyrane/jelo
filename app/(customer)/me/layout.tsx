import type { ReactNode } from 'react';
import { MeShelfStateProvider } from '@/components/me/shelf/me-shelf-state';

export default function MeLayout({ children }: { children: ReactNode }) {
  return <MeShelfStateProvider>{children}</MeShelfStateProvider>;
}
