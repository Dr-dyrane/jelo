import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import styles from './inventory-pagination.module.css';

function href(params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params);
  if (page <= 1) next.delete('page');
  else next.set('page', String(page));
  const query = next.toString();
  return query ? `/products?${query}#all-products` : '/products#all-products';
}

export function InventoryPagination({ page, pageCount, params }: { page: number; pageCount: number; params: URLSearchParams }) {
  if (pageCount <= 1) return null;
  const pages = Array.from(new Set([1, page - 1, page, page + 1, pageCount].filter(value => value >= 1 && value <= pageCount))).sort((a, b) => a - b);
  return <nav className={styles.pagination} aria-label="Catalogue pages">
    {page > 1 ? <Link href={href(params, page - 1)}><ArrowLeft size={16} aria-hidden="true"/> Previous</Link> : <span />}
    <div>{pages.map((value, index) => <span key={value}>{index > 0 && value - pages[index - 1] > 1 ? <i aria-hidden="true">…</i> : null}<Link className={value === page ? styles.current : ''} aria-current={value === page ? 'page' : undefined} href={href(params, value)}>{value}</Link></span>)}</div>
    {page < pageCount ? <Link href={href(params, page + 1)}>Next <ArrowRight size={16} aria-hidden="true"/></Link> : <span />}
  </nav>;
}
