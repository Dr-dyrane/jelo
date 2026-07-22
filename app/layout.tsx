import type { Metadata } from 'next';
import Link from 'next/link';
import { Italiana, Manrope } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SiteHeader } from '@/components/navigation/site-header';
import './globals.css';
import './platform.css';
import './consult-report.css';
import './evidence.css';
import './barrier-report.css';
import './timeline.css';
import './trend-report.css';
import './recommendation-audit.css';
import './storefront.css';
import './product-experience.css';
import './trust.css';

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
    <html lang="en" className={`${display.variable} ${sans.variable}`} data-scroll-behavior="smooth">
      <body>
        <SiteHeader />
        {children}
        <footer className="site-footer">
          <div className="footer-brand">
            <strong>JeloCare</strong>
            <p>Pharmacist-led care. By Dyrane.</p>
          </div>
          <div className="footer-group">
            <strong>Explore</strong>
            <Link href="/products">All products</Link>
            <Link href="/concerns">Shop by concern</Link>
            <Link href="/consult">Ask JeloCare</Link>
            <Link href="/ingredients">Ingredient library</Link>
          </div>
          <div className="footer-group">
            <strong>Connect</strong>
            <a href="mailto:hello@dyrane.tech">hello@dyrane.tech</a>
            <a href="mailto:hello@dyrane.tech?subject=JeloCare%20retail%20partnership">Retail partnerships</a>
            <a href="mailto:hello@dyrane.tech?subject=JeloCare%20affiliate%20partnership">Affiliate enquiries</a>
          </div>
          <div className="footer-legal">
            <span>Some links pay us. They never change our advice.</span>
            <span>© {new Date().getFullYear()} Dyrane · Guidance, not diagnosis.</span>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
