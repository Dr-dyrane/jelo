import type { Metadata, Viewport } from 'next';
import { Italiana, Manrope } from 'next/font/google';
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

// The single root layout: the html/body shell, fonts, and the no-flash theme.
// Chrome lives in nested layouts — (site) carries the public header and footer,
// (ops) the console, (auth) none — so not-found, error, and global-error render
// within this shell instead of falling back to an unstyled default.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
