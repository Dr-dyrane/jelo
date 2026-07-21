'use client';

import Link from 'next/link';
import { ArrowUpRight, Clock3, Moon, RefreshCw, ShieldAlert, Sparkles, Sun } from 'lucide-react';
import { useMemo, useState } from 'react';
import { inferMarket } from '@/data/prices';

const prompts = ['Tiny bumps on my forehead', 'Dark marks after acne', 'My face is oily and sensitive'];

type Report = {
  title: string;
  summary: string;
  pattern: string;
  routine: { time: 'Morning' | 'Evening' | 'Weekly' | 'Any time'; action: string }[];
  cautions: string[];
  productSlugs: string[];
  followUp: string;
};

type ConsultProduct = {
  slug: string;
  brand: string;
  name: string;
  image: string;
  size: string;
  step: string;
  displayLine: string;
  price: { amount: number; currency: 'NGN' | 'USD'; retailer: string; market: 'NG' | 'US' } | null;
  retailers: { retailer: string; href: string }[];
};

type Consultation = { report: Report; products: ConsultProduct[]; meta: { modelCalls: number; market: 'NG' | 'US'; concerns: string[]; fallback?: boolean } };

function formatPrice(product: ConsultProduct) {
  if (!product.price) return 'Live price';
  return new Intl.NumberFormat(product.price.currency === 'NGN' ? 'en-NG' : 'en-US', {
    style: 'currency', currency: product.price.currency, maximumFractionDigits: product.price.currency === 'NGN' ? 0 : 2,
  }).format(product.price.amount);
}

function RoutineIcon({ time }: { time: Report['routine'][number]['time'] }) {
  if (time === 'Morning') return <Sun size={18} />;
  if (time === 'Evening') return <Moon size={18} />;
  return <Clock3 size={18} />;
}

export function ConsultExperience() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<Consultation | null>(null);
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const market = useMemo(() => inferMarket(), []);

  async function submit(text: string) {
    const query = text.trim();
    if (!query || busy) return;
    setBusy(true);
    setError('');
    setSubmittedQuery(query);

    const cacheKey = `jelocare:consult:${market}:${query.toLowerCase().replace(/\s+/g, ' ')}`;
    const cached = window.localStorage.getItem(cacheKey);
    if (cached) {
      try {
        setResult(JSON.parse(cached));
        setInput('');
        setBusy(false);
        return;
      } catch { window.localStorage.removeItem(cacheKey); }
    }

    try {
      const response = await fetch('/api/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, market }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Consultation failed');
      setResult(payload);
      window.localStorage.setItem(cacheKey, JSON.stringify(payload));
      setInput('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The consultation could not continue.');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setResult(null);
    setSubmittedQuery('');
    setError('');
  }

  if (result) {
    return (
      <section className="consult-report" aria-live="polite">
        <header className="report-hero">
          <div>
            <p className="eyebrow"><Sparkles size={14}/> JeloCare assessment</p>
            <h2>{result.report.title}</h2>
            <p className="report-summary">{result.report.summary}</p>
          </div>
          <button className="report-reset" type="button" onClick={reset}><RefreshCw size={17}/> Ask another</button>
        </header>

        <div className="report-query"><span>You described</span><p>{submittedQuery}</p></div>

        <div className="report-grid">
          <article className="report-panel report-pattern">
            <p className="eyebrow">What it may fit</p>
            <h3>A useful working pattern</h3>
            <p>{result.report.pattern}</p>
            <div className="concern-chips">{result.meta.concerns.map(concern => <span key={concern}>{concern}</span>)}</div>
          </article>

          <article className="report-panel">
            <p className="eyebrow">Routine</p>
            <h3>Keep it deliberate.</h3>
            <div className="routine-list">
              {result.report.routine.map((item, index) => (
                <div className="routine-step" key={`${item.time}-${index}`}>
                  <span className="routine-icon"><RoutineIcon time={item.time}/></span>
                  <div><strong>{item.time}</strong><p>{item.action}</p></div>
                </div>
              ))}
            </div>
          </article>
        </div>

        {result.products.length ? (
          <section className="report-products">
            <div className="report-section-heading"><div><p className="eyebrow">Matched products</p><h3>Start with less.<br/>Choose well.</h3></div><span>{result.meta.market === 'US' ? 'United States offers' : 'Nigeria offers'}</span></div>
            <div className="consult-product-grid">
              {result.products.map(product => (
                <article className="consult-product" key={product.slug}>
                  <Link className="consult-product-image" href={`/products/${product.slug}`}>
                    <img src={product.image} alt={`${product.brand} ${product.name}`}/>
                    <span className="consult-product-price">{formatPrice(product)}</span>
                    <span className="consult-product-arrow"><ArrowUpRight size={19}/></span>
                  </Link>
                  <div className="consult-product-copy">
                    <p className="eyebrow">{product.brand}</p>
                    <h4><Link href={`/products/${product.slug}`}>{product.name}</Link></h4>
                    <p>{product.step} · {product.size}</p>
                    <div className="consult-retailers">
                      {product.retailers.map(offer => <a key={offer.retailer} href={offer.href}>{offer.retailer}<ArrowUpRight size={14}/></a>)}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <div className="report-bottom-grid">
          <article className="report-panel caution-panel">
            <p className="eyebrow"><ShieldAlert size={14}/> Watch for</p>
            <ul>{result.report.cautions.map(item => <li key={item}>{item}</li>)}</ul>
          </article>
          <article className="report-panel follow-panel">
            <p className="eyebrow">Follow-up</p>
            <p>{result.report.followUp}</p>
          </article>
        </div>
        <p className="report-disclaimer">One AI generation was used for this report. Reopening the same saved assessment does not create another model call. Guidance, not diagnosis.</p>
      </section>
    );
  }

  return (
    <section className="consult-card">
      <div className="consult-empty">
        <div className="consult-orb"><Sparkles size={24}/></div>
        <p>Tell us what you notice, where it is, how long it has been there, and what you have already tried.</p>
        <div className="prompt-row">{prompts.map(prompt => <button key={prompt} type="button" onClick={() => submit(prompt)}>{prompt}</button>)}</div>
      </div>
      <form className="consult-form" onSubmit={event => { event.preventDefault(); submit(input); }}>
        <textarea value={input} onChange={event => setInput(event.target.value)} placeholder="Describe your concern…" rows={4} aria-label="Describe your skin concern"/>
        <button type="submit" disabled={!input.trim() || busy}>{busy ? 'Considering…' : 'Create assessment'}</button>
      </form>
      {error ? <p className="consult-error">{error}</p> : null}
      <p className="consult-note">Urgent, painful or rapidly worsening symptoms need in-person care.</p>
    </section>
  );
}
