import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { OrderStatus } from "@/components/commerce/order-status";
import { readAssistedOrderBySession } from "@/lib/commerce/assisted-procurement-repository";
import {
  assistedOrderCookieName,
  hashOrderSecret,
} from "@/lib/commerce/assisted-procurement-security";
import styles from "@/components/commerce/order-status.module.css";
import { OrderRecoveryForm } from "@/components/commerce/order-recovery-form";
import { toAssistedOrderCustomerView } from "@/lib/commerce/assisted-procurement-model";

export const metadata: Metadata = {
  title: "Track order · JeloCare",
  description: "Private JeloCare order request status.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  openGraph: null,
  twitter: null,
};
export const dynamic = "force-dynamic";

export default async function OrderPage({
  searchParams,
}: {
  searchParams: Promise<{ recovery?: string; new?: string }>;
}) {
  noStore();
  const secret = (await cookies()).get(assistedOrderCookieName)?.value;
  const order = secret
    ? await readAssistedOrderBySession(hashOrderSecret(secret))
    : null;
  const { recovery, new: isNew } = await searchParams;
  return (
    <main className={styles.page}>
      {order ? (
        <OrderStatus
          order={toAssistedOrderCustomerView(order)}
          isNew={isNew === "1"}
        />
      ) : (
        <section className={styles.missing}>
          <p className="eyebrow">Private order status</p>
          <h1>
            {recovery === "expired"
              ? "That link has expired."
              : "No order on this device."}
          </h1>
          <p>
            Open the newest private link in your JeloCare email, or begin a
            guest basket. Recovery links work once; your clean status page then
            stays on this device.
          </p>
          <OrderRecoveryForm />
          <Link href="/products">Browse products</Link>
        </section>
      )}
    </main>
  );
}
