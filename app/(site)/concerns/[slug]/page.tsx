import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Layers3 } from 'lucide-react';
import { notFound } from 'next/navigation';
import { concerns, concernBySlug } from '@/data/knowledge';
import { ProductRail } from '@/components/products/product-grid';
import { listRecommendationEligibleProducts } from '@/lib/catalogue/repository';
import { concernSocialCard, publicSocialMetadata } from '@/lib/og/social-card';
import { productMatchesConcern } from '@/modules/concerns/product-matching';

export const revalidate = 3600;

export function generateStaticParams() {
  return concerns.map(concern => ({ slug: concern.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const concern = concernBySlug(slug);
  if (!concern) return {};
  const card = concernSocialCard(concern.slug);
  return card ? publicSocialMetadata(card, `/concerns/${concern.slug}`) : {};
}

export default async function ConcernPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const concern = concernBySlug(slug);
  if (!concern) notFound();
  const matches = concern.kind === 'concern'
    ? (await listRecommendationEligibleProducts()).filter(product => productMatchesConcern(product, concern))
    : [];

  return <main className="page-shell">
    <header className="page-heading"><p className="eyebrow">{concern.area} · {concern.kind === 'condition-pattern' ? 'Pattern guide' : 'Concern guide'}</p><h1>{concern.name}</h1><p>{concern.summary} Guidance, not a diagnosis.</p><Link className="concern-combine" href={concern.kind === 'concern' ? `/concerns?concerns=${concern.slug}` : '/concerns'}><Layers3 size={16} aria-hidden="true"/> {concern.kind === 'concern' ? 'Add another concern' : 'Browse concerns'}</Link></header>
    {concern.urgentAction ? <section className={`concern-urgent-action concern-urgent-action-${concern.urgentAction.urgency}`} aria-labelledby="concern-action-heading">
      <div><p>What to do now</p><h2 id="concern-action-heading">{concern.urgentAction.urgency === 'emergency' ? 'Get emergency help.' : 'Get medical help today.'}</h2></div>
      <p>{concern.urgentAction.guidance}</p>
    </section> : null}
    <section className="concern-detail-grid">
      <div className="concern-detail-panel"><p className="eyebrow">What it looks like</p><h2>Signs</h2><div className="concern-detail-chips">{concern.signals.map(item => <span key={item}>{item}</span>)}</div></div>
      <div className="concern-detail-panel"><p className="eyebrow">What may help</p><h2>Options</h2><div className="concern-detail-chips">{concern.ingredients.map(item => {
        const source = concern.ingredientSources?.[item];
        return <span className={source ? 'concern-detail-chip-sourced' : undefined} key={item}>{item}{source ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : null}</span>;
      })}</div></div>
      <div className="concern-detail-panel concern-help-panel"><p className="eyebrow">When to get help</p><h2>Pause here</h2><p className="concern-alert">{concern.escalation}</p></div>
    </section>
    <section className="concern-sources"><div><p className="eyebrow">Links checked {concern.reviewedAt}</p><h2>Sources.</h2></div><div>{concern.sources.map(source => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.title}</a>)}</div></section>
    {concern.kind === 'concern' ? <section className="concern-matches"><p className="eyebrow">Products</p><div className="section-heading"><h2>{matches.length ? 'Catalogue matches.' : 'Care first.'}</h2></div>{matches.length ? <ProductRail products={matches}/> : <p className="concern-no-match">Start with the care options above.</p>}</section> : null}
    <section className="concern-ask-cta">
      <div>
        <p className="eyebrow">Still deciding?</p>
        <h2>Ask JeloCare about {concern.name}.</h2>
        <p>Describe what you notice in your own words and get a care-first guide.</p>
      </div>
      <Link className="concern-ask-link" href={`/consult?q=${encodeURIComponent(concern.name)}`}>Ask JeloCare <ArrowRight size={16} aria-hidden="true"/></Link>
    </section>
  </main>;
}
