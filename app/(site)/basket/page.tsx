import type { Metadata } from 'next';
import { listCatalogueProducts } from '@/lib/catalogue/repository';
import { ProcurementBasket } from '@/components/commerce/procurement-basket';
import styles from '@/components/commerce/procurement.module.css';

export const metadata: Metadata = {
  title: 'Basket · JeloCare',
  description: 'Choose one retailer for an exact JeloCare basket.',
  robots: { index: false, follow: false },
  openGraph: null,
  twitter: null,
};

export default async function BasketPage() {
  const products = await listCatalogueProducts();
  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div><p className="eyebrow">Guest-first</p><h1>One exact basket.</h1></div>
        <p>Choose one retailer. JeloCare then verifies delivery and every cost before you approve anything.</p>
      </header>
      <ProcurementBasket products={products} />
    </main>
  );
}
