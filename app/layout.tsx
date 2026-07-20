import type { Metadata } from 'next';
import { Italiana, Manrope } from 'next/font/google';
import './globals.css';

const italiana = Italiana({ weight: '400', subsets: ['latin'], variable: '--font-display' });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://jelocare.com'),
  title: { default: 'JeloCare', template: '%s · JeloCare' },
  description: 'Understand your skin. Find what fits. Buy from the most trusted available source.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${italiana.variable} ${manrope.variable}`}><body>{children}</body></html>;
}
