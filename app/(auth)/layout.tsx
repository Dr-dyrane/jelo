import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'Sign in · JeloCare Ops' },
  robots: { index: false, follow: false },
  openGraph: null,
  twitter: null,
};

// No chrome: the sign-in page owns its full-screen shell. The html/body and theme
// come from the root layout.
export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
