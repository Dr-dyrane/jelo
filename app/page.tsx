import Link from 'next/link';
import { ProductRail } from '@/components/products/product-grid';
import { products } from '@/data/catalogue';

export default function HomePage() {
  return <main>
    <section className="hero-shell">
      <div className="hero-copy"><p className="eyebrow">Pharmacist-led skin intelligence</p><h1>Understand<br/>your skin.</h1><p className="hero-deck">Find what fits. Buy from the most trusted available source.</p><div className="hero-actions"><Link className="button primary" href="/consult">Ask JeloCare</Link><Link className="button ghost" href="/products">Browse products</Link></div></div>
      <div className="hero-art"><div className="orb orb-one"/><div className="orb orb-two"/><div className="hero-word">care</div></div>
    </section>
    <section className="section-shell"><div className="section-heading"><div><p className="eyebrow">The collection</p><h2>Every formula<br/>earns its place.</h2></div><Link className="text-link" href="/products">View all →</Link></div><ProductRail products={products.slice(0,12)}/></section>
    <section className="principle-shell"><p className="eyebrow">The principle</p><h2>Recommendation first.<br/>Revenue second.</h2><p>Fit, trust, availability and delivered value decide what comes first.</p></section>
  </main>;
}
