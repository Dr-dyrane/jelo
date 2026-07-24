import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Italiana, Manrope } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SiteHeader } from '@/components/navigation/site-header';
import { ThemeToggle } from '@/components/navigation/theme-toggle';
import '../globals.css';
import '../platform.css';
import '../consult-report.css';
import '../consult-sheet.css';
import '../ask-jelo-safety.css';
import '../evidence.css';
import '../barrier-report.css';
import '../timeline.css';
import '../trend-report.css';
import '../recommendation-audit.css';
import '../storefront.css';
import '../product-experience.css';
import '../product-panel.css';
import '../concern-detail.css';
import '../trust.css';
import '../interaction.css';

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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f29c85' },
    { media: '(prefers-color-scheme: dark)', color: '#191413' },
  ],
  colorScheme: 'light dark',
};

// Default to light (not the OS preference): only an explicit stored 'dark' opts in.
// Setting data-theme="light" explicitly also keeps the prefers-color-scheme:dark
// overrides from ever applying on a dark-OS machine.
const themeScript = `(function(){try{var t=localStorage.getItem('jelo-theme');var m=t==='dark'?'dark':'light';var e=document.documentElement;e.setAttribute('data-theme',m);e.style.colorScheme=m;}catch(err){var e=document.documentElement;e.setAttribute('data-theme','light');e.style.colorScheme='light';}})();`;

export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
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
            <Link href="/contribute">Share skincare</Link>
            <Link href="/consult">Ask JeloCare</Link>
            <Link href="/ingredients">Ingredient library</Link>
            <Link href="/retailers">Retailer guide</Link>
          </div>
          <div className="footer-group">
            <strong>Connect</strong>
            <Link href="/share">Worth sharing</Link>
            <a href="mailto:hello@jelocare.com">hello@jelocare.com</a>
            <Link href="/retailers#list-your-store">Retail partnerships</Link>
            <a href="mailto:hello@jelocare.com?subject=JeloCare%20affiliate%20partnership">Affiliate enquiries</a>
          </div>
          <div className="footer-legal">
            <ThemeToggle />
            <span>© {new Date().getFullYear()} Dyrane · Guidance, not diagnosis.</span>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
