import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Italiana, Manrope } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SiteHeader } from '@/components/navigation/site-header';
import './globals.css';
import './platform.css';
import './consult-report.css';
import './consult-sheet.css';
import './ask-jelo-safety.css';
import './evidence.css';
import './barrier-report.css';
import './timeline.css';
import './trend-report.css';
import './recommendation-audit.css';
import './storefront.css';
import './product-experience.css';
import './product-panel.css';
import './concern-detail.css';
import './trust.css';
import './interaction.css';

const display = Italiana({ weight: '400', subsets: ['latin'], variable: '--font-display' });
const sans = Manrope({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  metadataBase: new URL('https://www.jelocare.com'),
  applicationName: 'JeloCare',
  title: { default: 'JeloCare — Understand your skin', template: '%s · JeloCare' },
  description: 'Skin education and clear product discovery.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'JeloCare' },
  formatDetection: { telephone: false },
  openGraph: {
    title: 'JeloCare',
    description: 'Understand your skin. Find what fits.',
    url: 'https://www.jelocare.com',
    siteName: 'JeloCare',
    type: 'website',
    images: [{
      url: '/social/jelocare-open-graph-v1.jpg',
      width: 1200,
      height: 630,
      alt: 'JeloCare — Know before you buy.',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'JeloCare',
    description: 'Understand your skin. Find what fits.',
    images: ['/social/jelocare-open-graph-v1.jpg'],
  },
};

export const viewport: Viewport = {
  themeColor: '#f29c85',
  colorScheme: 'light',
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
            <p>Clear skin education. By Dyrane.</p>
          </div>
          <div className="footer-group">
            <strong>Explore</strong>
            <Link href="/products">All products</Link>
            <Link href="/concerns">Browse concerns</Link>
            <Link href="/contribute">Contribute</Link>
            <Link href="/consult">Ask JeloCare</Link>
            <Link href="/ingredients">Ingredient library</Link>
            <Link href="/retailers">Retailer guide</Link>
          </div>
          <div className="footer-group">
            <strong>Connect</strong>
            <a href="mailto:hello@dyrane.tech">hello@dyrane.tech</a>
            <a href="mailto:hello@dyrane.tech?subject=JeloCare%20retail%20partnership">Retail partnerships</a>
            <a href="mailto:hello@dyrane.tech?subject=JeloCare%20affiliate%20partnership">Affiliate enquiries</a>
          </div>
          <div className="footer-legal">
            <span>© {new Date().getFullYear()} Dyrane · Guidance, not diagnosis.</span>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
