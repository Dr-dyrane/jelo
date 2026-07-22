'use client';

/* eslint-disable @next/next/no-img-element -- This audit intentionally observes native image load and error events for arbitrary runtime URLs. */

import { useEffect, useMemo, useState } from 'react';
import type { Product } from '@/data/products';

type Status = 'checking' | 'ok' | 'failed' | 'placeholder';
type Filter = 'needs-source' | 'failed' | 'placeholder' | 'ok' | 'all';
type Row = Product & { status: Status; host: string; sourceType: 'local' | 'remote' };

function imageHost(src: string) {
  if (src.startsWith('/')) return 'local';
  try {
    return new URL(src).hostname.replace(/^www\./, '');
  } catch {
    return 'invalid-url';
  }
}

function isPlaceholder(src: string) {
  return src.startsWith('/product-fallback') || src.startsWith('/product-placeholder');
}

export function ProductImageAudit({ products }: { products: Product[] }) {
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [filter, setFilter] = useState<Filter>('needs-source');
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const probes: HTMLImageElement[] = [];

    for (const product of products) {
      if (isPlaceholder(product.image)) continue;
      const probe = new window.Image();
      probes.push(probe);
      probe.referrerPolicy = 'no-referrer';
      probe.onload = () => {
        if (!active) return;
        setStatuses(current => current[product.slug] === 'ok' ? current : ({ ...current, [product.slug]: 'ok' }));
      };
      probe.onerror = () => {
        if (!active) return;
        setStatuses(current => current[product.slug] === 'failed' ? current : ({ ...current, [product.slug]: 'failed' }));
      };
      probe.src = product.image;
    }

    return () => {
      active = false;
      for (const probe of probes) {
        probe.onload = null;
        probe.onerror = null;
      }
    };
  }, [attempt, products]);

  const rows = useMemo<Row[]>(() => products.map(product => ({
    ...product,
    status: isPlaceholder(product.image) ? 'placeholder' : statuses[product.slug] ?? 'checking',
    host: imageHost(product.image),
    sourceType: product.image.startsWith('/') ? 'local' : 'remote',
  })), [products, statuses]);

  const counts = useMemo(() => ({
    failed: rows.filter(row => row.status === 'failed').length,
    placeholder: rows.filter(row => row.status === 'placeholder').length,
    checking: rows.filter(row => row.status === 'checking').length,
    ok: rows.filter(row => row.status === 'ok').length,
  }), [rows]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter(row => {
      const matchesFilter = filter === 'all'
        || (filter === 'needs-source' && (row.status === 'failed' || row.status === 'placeholder'))
        || row.status === filter;
      const matchesQuery = !normalized || `${row.brand} ${row.name} ${row.slug} ${row.host}`.toLowerCase().includes(normalized);
      return matchesFilter && matchesQuery;
    });
  }, [filter, query, rows]);

  function retry() {
    setStatuses({});
    setAttempt(value => value + 1);
  }

  function exportReport() {
    const report = rows
      .filter(row => row.status === 'failed' || row.status === 'placeholder')
      .map(({ slug, brand, name, image, status, host, sourceType }) => ({ slug, brand, name, image, status, host, sourceType }));
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'jelocare-image-audit.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section style={{ display: 'grid', gap: '1.5rem', paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '.7rem' }}>
        <strong>{products.length} total</strong>
        <span>{counts.ok} healthy</span>
        <span>{counts.failed} failed</span>
        <span>{counts.placeholder} placeholders</span>
        <span>{counts.checking} checking</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.65rem', alignItems: 'center' }}>
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Brand, product or host"
          aria-label="Filter image audit"
          style={{ minHeight: '2.8rem', flex: '1 1 16rem', border: 0, borderRadius: '999px', padding: '0 1rem', background: 'rgba(255,255,255,.62)', font: 'inherit' }}
        />
        {(['needs-source', 'failed', 'placeholder', 'ok', 'all'] as Filter[]).map(value => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            style={{ minHeight: '2.6rem', border: 0, borderRadius: '999px', padding: '0 .9rem', cursor: 'pointer', background: filter === value ? 'var(--ink)' : 'rgba(255,255,255,.58)', color: filter === value ? '#fff' : 'var(--ink)' }}
          >
            {value.replace('-', ' ')}
          </button>
        ))}
        <button type="button" onClick={retry} style={{ minHeight: '2.6rem', border: 0, borderRadius: '999px', padding: '0 .9rem', cursor: 'pointer', background: 'rgba(255,255,255,.58)' }}>Retry</button>
        <button type="button" onClick={exportReport} disabled={counts.failed + counts.placeholder === 0} style={{ minHeight: '2.6rem', border: 0, borderRadius: '999px', padding: '0 .9rem', cursor: 'pointer', background: 'rgba(255,255,255,.58)' }}>Export JSON</button>
      </div>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {visible.length === 0 ? <p>No products match this view.</p> : visible.map(product => (
          <article key={product.slug} style={{ display: 'grid', gridTemplateColumns: '88px minmax(0,1fr)', gap: '1rem', alignItems: 'center', padding: '1rem', borderRadius: '1.25rem', background: 'rgba(255,255,255,.52)' }}>
            <img src={product.status === 'failed' ? '/product-placeholder.svg' : product.image} alt="" width={88} height={88} style={{ width: 88, height: 88, objectFit: 'contain', borderRadius: '1rem', background: '#fffaf6' }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', alignItems: 'baseline' }}>
                <strong>{product.brand} · {product.name}</strong>
                <span style={{ fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.08em', opacity: .62 }}>{product.status}</span>
              </div>
              <p style={{ margin: '.25rem 0', opacity: .7 }}>{product.status === 'placeholder' ? 'Explicit placeholder — excluded from the live catalogue' : product.status === 'failed' ? 'Remote image failed in the browser and falls back at runtime' : product.status === 'checking' ? 'Waiting for browser verification' : 'Image loaded successfully'}</p>
              <p style={{ margin: '.2rem 0', fontSize: '.74rem', opacity: .7 }}>Source: {product.host} · {product.sourceType}</p>
              <code style={{ display: 'block', overflowWrap: 'anywhere', fontSize: '.72rem' }}>{product.image}</code>
            </div>
          </article>
        ))}
      </div>

    </section>
  );
}
