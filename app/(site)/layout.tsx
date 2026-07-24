import Link from 'next/link';
import { Analytics } from '@vercel/analytics/next';
import { SiteHeader } from '@/components/navigation/site-header';
import { ThemeToggle } from '@/components/navigation/theme-toggle';

// Public chrome. The html/body shell, fonts, and theme come from the root layout.
export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
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
    </>
  );
}
