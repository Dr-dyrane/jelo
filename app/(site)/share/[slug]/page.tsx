import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { buildShareData } from "./share-data";
import { ShareAlternatives, ShareCard } from "./share-card";
import { Reveal } from "@/components/motion/reveal";
import { ShareButton } from "@/components/share/share-button";
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
  return (
    <ProductTrendsChart
      data={trendData}
      storyHref={`/share/${slug}/story?kind=trend`}
    />
  );
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await buildShareData(slug);
  if (!data) notFound();
  const signals = await getWorthSharingReadModel();
  const alternatives = selectShareRecommendations(signals.rankedPool, slug);

  return (
    <main className={styles.stage}>
      <Reveal className={styles.headlineRow} duration={0.6}>
        <h1 className={styles.headline}>
          {data.headlineLead}
          {data.headlineEmph ? (
            <>
              <br />
              <em>{data.headlineEmph}</em>
            </>
          ) : null}
        </h1>
      </Reveal>
      <div className={styles.cardGrid}>
        <ShareCard
          view={data.view}
          storyHref={`/share/${slug}/story?kind=price`}
        />
        <Suspense fallback={null}>
          <ProductTrendsSection slug={slug} />
        </Suspense>
      </div>
      <Reveal className={styles.actions} delay={0.2}>
        <ShareButton
          path={`/share/${slug}`}
          title={`${data.view.brand} ${data.view.name}`}
        />
        <Link href={`/products/${slug}`} className={styles.textLink}>
          See the full product →
        </Link>
      </Reveal>
      {alternatives.length > 0 ? (
        <Reveal delay={0.3}>
          <ShareAlternatives items={alternatives} />
        </Reveal>
      ) : null}
    </main>
  );
}
