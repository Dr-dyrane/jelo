import type { Metadata } from "next";
import { listCatalogueProducts } from "@/lib/catalogue/repository";
import { CheckoutExperience } from "@/components/commerce/procurement-basket";
import styles from "@/components/commerce/procurement.module.css";
import { getCustomerIdentity } from "@/lib/customer/access";
import { customerLocationService } from "@/lib/customer/location-service";

export const metadata: Metadata = {
  title: "Checkout · JeloCare",
  description: "Request one exact, retailer-scoped JeloCare quote.",
  robots: { index: false, follow: false },
  openGraph: null,
  twitter: null,
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const [products, identity] = await Promise.all([
    listCatalogueProducts(),
    getCustomerIdentity(),
  ]);
  const savedLocations = identity
    ? (await customerLocationService.read(identity)).locations.filter(
        (location) => location.kind === "delivery",
      )
    : [];
  return (
    <main className={styles.page}>
      <CheckoutExperience products={products} savedLocations={savedLocations} />
    </main>
  );
}
