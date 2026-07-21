import type { Metadata } from 'next';
import { Italiana, Manrope } from 'next/font/google';
import { SiteHeader } from '@/components/navigation/site-header';
import './globals.css';
import './platform.css';
import './consult-report.css';
import './evidence.css';
import './barrier-report.css';
import './timeline.css';
import './trend-report.css';
import './recommendation-audit.css';

const display = Italiana({ weight: '400', subsets: ['latin'], variable: '--font-display' });
const sans = Manrope({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  metadataBase: new URL('https://jelocare.com'),
  title: { default: 'JeloCare — Understand your skin', template: '%s · JeloCare' },
  description: 'Pharmacist-led skin guidance and trusted product discovery.',
  openGraph: { title: 'JeloCare', description: 'Understand your skin. Find what fits.', url: 'https://jelocare.com', siteName: 'JeloCare', type: 'website' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <SiteHeader />
        {children}
        <footer className="site-footer"><span>JeloCare</span><span>Guidance, not diagnosis.</span></footer>
      </body>
    </html>
  );
}
