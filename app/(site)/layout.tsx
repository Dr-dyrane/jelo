import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { SiteHeader } from "@/components/navigation/site-header";
import { ThemeToggle } from "@/components/navigation/theme-toggle";
import { NavigationMemory } from "@/components/navigation/navigation-memory";
import { BasketProvider } from "@/components/commerce/basket-provider";
import { PublicBasketPill } from "@/components/commerce/public-basket-pill";
import { listCatalogueProducts } from "@/lib/catalogue/repository";

// Public chrome. The html/body shell, fonts, and theme come from the root layout.
export default async function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const products = await listCatalogueProducts();
  const basketProducts = products.map(({ slug, brand, name, image }) => ({
    slug,
    brand,
    name,
    image,
  }));

  return (
    <BasketProvider>
      <NavigationMemory />
      <SiteHeader />
      {children}
      <PublicBasketPill products={basketProducts} />
      <footer className="site-footer">
        <div className="footer-brand">
          <strong>JeloCare</strong>
          <p>Products, prices, and clear care context.</p>
        </div>
        <nav className="footer-navigation" aria-label="Footer navigation">
          <div className="footer-group">
            <strong>Discover</strong>
            <Link href="/products">Products</Link>
            <Link href="/brands">Brands</Link>
            <Link href="/concerns">Concerns</Link>
            <Link href="/ingredients">Ingredients</Link>
          </div>
          <div className="footer-group">
            <strong>Compare</strong>
            <Link href="/share">Price watch</Link>
            <Link href="/lagos">Lagos Daily Desk</Link>
            <Link href="/bundle">Bundle finder</Link>
            <Link href="/retailers">Retailers</Link>
          </div>
          <div className="footer-group">
            <strong>Your care</strong>
            <Link href="/consult">Ask JeloCare</Link>
            <Link className="footer-member-link" href="/me">
              My JeloCare
            </Link>
            <Link href="/contribute">Contribute</Link>
          </div>
          <div className="footer-group">
            <strong>Partners</strong>
            <Link href="/retailers#list-your-store">List your store</Link>
            <a href="mailto:hello@jelocare.com?subject=JeloCare%20affiliate%20partnership">
              Affiliate enquiries
            </a>
            <a href="mailto:hello@jelocare.com">Email JeloCare</a>
          </div>
        </nav>
        <div className="footer-legal">
          <ThemeToggle />
          <span>
            © {new Date().getFullYear()} Dyrane · Guidance, not diagnosis.
          </span>
        </div>
      </footer>
      <Analytics />
    </BasketProvider>
  );
}
