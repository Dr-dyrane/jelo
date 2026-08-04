import type { Viewport } from 'next';
import type { ReactNode } from 'react';
import { MeShelfStateProvider } from '@/components/me/shelf/me-shelf-state';

export const viewport: Viewport = {
  viewportFit: 'cover',
};

export default function MeLayout({ children }: { children: ReactNode }) {
  return <MeShelfStateProvider>{children}</MeShelfStateProvider>;
}
