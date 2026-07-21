import type { Metadata } from 'next';
import { Italiana, Manrope } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import './platform.css';
import './consult-report.css';
import './evidence.css';
import './barrier-report.css';

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
        <header className="site-header">
          <Link className="site-logo" href="/">JELOCARE</Link>
          <nav aria-label="Primary navigation"><Link href="/concerns">Concerns</Link><Link href="/products">Products</Link><Link href="/consult">Consult</Link></nav>
        </header>
        {children}
        <footer className="site-footer"><span>JeloCare</span><span>Guidance, not diagnosis.</span></footer>
      </body>
    </html>
  );
}