import type { Metadata, Viewport } from 'next';
import { unstable_noStore as noStore } from 'next/cache';
import type { ReactNode } from 'react';
import { MeShelfStateProvider } from '@/components/me/shelf/me-shelf-state';
import { MeConcernStateProvider } from '@/components/me/consult/me-concern-state';
import { MeExploreStateProvider } from '@/components/me/explore/me-explore-state';

export const viewport: Viewport = {
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: { absolute: 'My JeloCare' },
  description: 'Private JeloCare workspace.',
  robots: { index: false, follow: false },
  openGraph: null,
  twitter: null,
};

export default function MeLayout({ children }: { children: ReactNode }) {
  noStore();
  return (
    <MeShelfStateProvider>
      <MeConcernStateProvider>
        <MeExploreStateProvider>{children}</MeExploreStateProvider>
      </MeConcernStateProvider>
    </MeShelfStateProvider>
  );
}
