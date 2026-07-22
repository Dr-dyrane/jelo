'use client';

/* eslint-disable @next/next/no-img-element -- This audit intentionally observes native image load and error events for arbitrary runtime URLs. */

import { useEffect, useMemo, useState } from 'react';
import type { EditorialAsset } from '@/data/editorial';
import type { Product } from '@/data/products';

type Status = 'checking' | 'ok' | 'failed' | 'placeholder';
type Filter = 'needs-source' | 'failed' | 'placeholder' | 'ok' | 'all';
type AuditTarget = {
  key: string;
  slug: string;
  brand: string;
  name: string;
  image: string;
  fallback: string;
  kind: 'product' | 'editorial';
};
type Row = AuditTarget & { status: Status; fallbackStatus?: Status; host: string; sourceType: 'local' | 'remote' };

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

export function ProductImageAudit({ products, editorialAssets }: { products: Product[]; editorialAssets: EditorialAsset[] }) {
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [filter, setFilter] = useState<Filter>('needs-source');
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);
  const targets = useMemo<AuditTarget[]>(() => [
    ...products.map(product => ({
      key: `product:${product.slug}`,
      slug: product.slug,
      brand: product.brand,
      name: product.name,
      image: product.image,
      fallback: '/product-placeholder.svg',
      kind: 'product' as const,
    })),
    ...editorialAssets.map(asset => ({
      key: `editorial:${asset.id}`,
      slug: asset.id,
      brand: 'JeloCare',
      name: asset.altText,
      image: asset.blobUrl,
      fallback: asset.localPath,
      kind: 'editorial' as const,
    })),
  ], [editorialAssets, products]);

  useEffect(() => {
    let active = true;
    const probes: HTMLImageElement[] = [];

    function probeImage(key: string, src: string) {
      const probe = new window.Image();
      probes.push(probe);
      probe.referrerPolicy = 'no-referrer';
      probe.onload = () => {
        if (!active) return;
        setStatuses(current => current[key] === 'ok' ? current : ({ ...current, [key]: 'ok' }));
      };
      probe.onerror = () => {
        if (!active) return;
        setStatuses(current => current[key] === 'failed' ? current : ({ ...current, [key]: 'failed' }));
      };
      probe.src = src;
    }

    for (const target of targets) {
      if (!isPlaceholder(target.image)) probeImage(target.key, target.image);
      if (target.kind === 'editorial') probeImage(`fallback:${target.key}`, target.fallback);
    }

    return () => {
      active = false;
      for (const probe of probes) {
        probe.onload = null;
        probe.onerror = null;
      }
    };
  }, [attempt, targets]);

  const rows = useMemo<Row[]>(() => targets.map(target => ({
    ...target,
    status: isPlaceholder(target.image) ? 'placeholder' : statuses[target.key] ?? 'checking',
    fallbackStatus: target.kind === 'editorial' ? statuses[`fallback:${target.key}`] ?? 'checking' : undefined,
    host: imageHost(target.image),
    sourceType: target.image.startsWith('/') ? 'local' : 'remote',
  })), [statuses, targets]);

  const counts = useMemo(() => ({
    failed: rows.filter(row => row.status === 'failed').length,
    placeholder: rows.filter(row => row.status === 'placeholder').length,
    checking: rows.filter(row => row.status === 'checking').length,
    ok: rows.filter(row => row.status === 'ok').length,
    fallbackOk: rows.filter(row => row.fallbackStatus === 'ok').length,
    fallbackFailed: rows.filter(row => row.fallbackStatus === 'failed').length,
  }), [rows]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter(row => {
      const matchesFilter = filter === 'all'
        || (filter === 'needs-source' && (row.status === 'failed' || row.status === 'placeholder' || row.fallbackStatus === 'failed'))
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
      .filter(row => row.status === 'failed' || row.status === 'placeholder' || row.fallbackStatus === 'failed')
      .map(({ slug, brand, name, image, fallback, kind, status, fallbackStatus, host, sourceType }) => ({ slug, brand, name, image, fallback, kind, status, fallbackStatus, host, sourceType }));
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
        <strong>{rows.length} total</strong>
        <span>{counts.ok} healthy</span>
        <span>{counts.failed} failed</span>
        <span>{counts.placeholder} placeholders</span>
        <span>{counts.checking} checking</span>
        <span>{counts.fallbackOk} fallbacks ready</span>
        <span>{counts.fallbackFailed} fallback failures</span>
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
        <button type="button" onClick={exportReport} disabled={counts.failed + counts.placeholder + counts.fallbackFailed === 0} style={{ minHeight: '2.6rem', border: 0, borderRadius: '999px', padding: '0 .9rem', cursor: 'pointer', background: 'rgba(255,255,255,.58)' }}>Export JSON</button>
      </div>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {visible.length === 0 ? <p>No products match this view.</p> : visible.map(product => (
          <article key={product.key} style={{ display: 'grid', gridTemplateColumns: '88px minmax(0,1fr)', gap: '1rem', alignItems: 'center', padding: '1rem', borderRadius: '1.25rem', background: 'rgba(255,255,255,.52)' }}>
            <img src={product.status === 'failed' ? product.fallback : product.image} alt="" width={88} height={88} style={{ width: 88, height: 88, objectFit: 'contain', borderRadius: '1rem', background: '#fffaf6' }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', alignItems: 'baseline' }}>
                <strong>{product.brand} · {product.name}</strong>
                <span style={{ fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.08em', opacity: .62 }}>{product.status}</span>
              </div>
              <p style={{ margin: '.25rem 0', opacity: .7 }}>{product.status === 'placeholder' ? 'Explicit placeholder — excluded from the live catalogue' : product.status === 'failed' ? 'Canonical image failed. The local fallback is shown.' : product.status === 'checking' ? 'Waiting for browser verification' : 'Canonical image loaded.'}</p>
              <p style={{ margin: '.2rem 0', fontSize: '.74rem', opacity: .7 }}>Source: {product.host} · {product.kind} · {product.sourceType}</p>
              <code style={{ display: 'block', overflowWrap: 'anywhere', fontSize: '.72rem' }}>{product.image}</code>
              {product.kind === 'editorial' ? <code style={{ display: 'block', marginTop: '.2rem', overflowWrap: 'anywhere', fontSize: '.72rem', opacity: .68 }}>Fallback: {product.fallback} · {product.fallbackStatus}</code> : null}
            </div>
          </article>
        ))}
      </div>

    </section>
  );
}
