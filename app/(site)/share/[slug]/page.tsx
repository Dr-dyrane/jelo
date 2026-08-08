import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { buildShareData } from "./share-data";
import { ShareAlternatives, ShareCard } from "./share-card";
import { ShareButton } from "@/components/share/share-button";
import { ScreenshotButton } from "@/components/share/screenshot-button";
import { ProductTrendsChart } from "@/components/product-trends/product-trends-chart";
import { getWorthSharingReadModel } from "@/lib/share/worth-sharing";
import { getProductTrendData } from "@/lib/share/product-trends";
import { productSocialCard, publicSocialMetadata } from "@/lib/og/social-card";
import { selectShareRecommendations } from "@/modules/commerce/share-insights";
import styles from "./share-card.module.css";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await buildShareData(slug);
  if (!data) return {};
  const url = `/share/${slug}`;
  return publicSocialMetadata(
    productSocialCard(
      {
        slug: data.view.productSlug,
        brand: data.view.brand,
        name: data.view.name,
        size: data.view.size,
        category: data.view.category,
        image: data.view.image,
      },
      "share",
    ),
    url,
  );
}

async function ProductTrendsSection({ slug }: { slug: string }) {
  const trendData = await getProductTrendData(slug);
  if (!trendData) return null;
  return <ProductTrendsChart data={trendData} />;
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [data, signals] = await Promise.all([
    buildShareData(slug),
    getWorthSharingReadModel(),
  ]);
  if (!data) notFound();
  const alternatives = selectShareRecommendations(signals.rankedPool, slug);

  return (
    <main className={styles.stage}>
      <div className={styles.headlineRow}>
        <h1 className={styles.headline}>
          {data.headlineLead}
          {data.headlineEmph ? (
            <>
              <br />
              <em>{data.headlineEmph}</em>
            </>
          ) : null}
        </h1>
        <ScreenshotButton
          targetId="card-grid"
          fileName={`${data.view.brand}-${data.view.name}-jelocare`}
        />
      </div>
      <div id="card-grid" className={styles.cardGrid}>
        <ShareCard view={data.view} />
        <Suspense fallback={null}>
          <ProductTrendsSection slug={slug} />
        </Suspense>
      </div>
      <div className={styles.actions}>
        <ShareButton
          path={`/share/${slug}`}
          title={`${data.view.brand} ${data.view.name}`}
        />
        <Link href={`/products/${slug}`} className={styles.textLink}>
          See the full product →
        </Link>
      </div>
      {alternatives.length > 0 ? (
        <ShareAlternatives items={alternatives} />
      ) : null}
    </main>
  );
}
