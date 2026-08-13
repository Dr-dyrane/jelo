import type { Metadata } from 'next';
import { listCatalogueProducts } from '@/lib/catalogue/repository';
import { CheckoutExperience } from '@/components/commerce/procurement-basket';
import styles from '@/components/commerce/procurement.module.css';

export const metadata: Metadata = {
  title: 'Checkout · JeloCare',
  description: 'Request one exact, retailer-scoped JeloCare quote.',
  robots: { index: false, follow: false },
  openGraph: null,
  twitter: null,
};

export default async function CheckoutPage() {
  const products = await listCatalogueProducts();
  return <main className={styles.page}><CheckoutExperience products={products} /></main>;
}
