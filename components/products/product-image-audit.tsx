'use client';

import { useMemo, useState } from 'react';
import type { Product } from '@/data/products';

type Status = 'checking' | 'ok' | 'failed' | 'placeholder';

type Row = Product & { status: Status };

export function ProductImageAudit({ products }: { products: Product[] }) {
  const [statuses, setStatuses] = useState<Record<string, Status>>({});

  const rows = useMemo<Row[]>(() => products.map(product => ({
    ...product,
    status: product.image.startsWith('/product-fallback') || product.image.startsWith('/product-placeholder')
      ? 'placeholder'
      : statuses[product.slug] ?? 'checking',
  })), [products, statuses]);

  const failed = rows.filter(row => row.status === 'failed');
  const placeholders = rows.filter(row => row.status === 'placeholder');
  const checking = rows.filter(row => row.status === 'checking');
  const ok = rows.filter(row => row.status === 'ok');

  return (
    <section style={{ display: 'grid', gap: '2rem', paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.75rem' }}>
        <strong>{products.length} total</strong>
        <span>{ok.length} loading</span>
        <span>{failed.length} failed</span>
        <span>{placeholders.length} placeholders</span>
        <span>{checking.length} checking</span>
      </div>

      {(failed.length > 0 || placeholders.length > 0) && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <h2>Needs sourcing</h2>
          {[...failed, ...placeholders].map(product => (
            <article key={product.slug} style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: '1rem', alignItems: 'center', padding: '1rem', borderRadius: '1.25rem', background: 'rgba(255,255,255,.52)' }}>
              <img src={product.image} alt="" width={72} height={72} style={{ width: 72, height: 72, objectFit: 'contain', borderRadius: '1rem', background: '#fffaf6' }} />
              <div style={{ minWidth: 0 }}>
                <strong>{product.brand} · {product.name}</strong>
                <p style={{ margin: '.25rem 0', opacity: .7 }}>{product.status === 'placeholder' ? 'Explicit placeholder' : 'Remote image failed to load'}</p>
                <code style={{ display: 'block', overflowWrap: 'anywhere', fontSize: '.72rem' }}>{product.image}</code>
              </div>
            </article>
          ))}
        </div>
      )}

      <div aria-hidden="true" style={{ position: 'fixed', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
        {products.map(product => {
          if (product.image.startsWith('/product-fallback') || product.image.startsWith('/product-placeholder')) return null;
          return (
            <img
              key={product.slug}
              src={product.image}
              alt=""
              referrerPolicy="no-referrer"
              onLoad={() => setStatuses(current => current[product.slug] === 'ok' ? current : ({ ...current, [product.slug]: 'ok' }))}
              onError={() => setStatuses(current => current[product.slug] === 'failed' ? current : ({ ...current, [product.slug]: 'failed' }))}
            />
          );
        })}
      </div>
    </section>
  );
}
