import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";
import { DailyDeskMeasurement } from "@/components/campaigns/daily-desk-measurement";
import { getDailyDeskReadModel } from "@/lib/campaigns/daily-desk";
import {
  concernsLinkedToProduct,
  allConcernSummaries,
} from "@/lib/clinical/concern-product-links";
import { publicSocialMetadata, staticSocialCard } from "@/lib/og/social-card";
import styles from "./lagos-daily-desk.module.css";

export const revalidate = 300;

export const metadata: Metadata = publicSocialMetadata(
  staticSocialCard("daily-desk"),
  "/lagos",
);

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos",
  weekday: "long",
  day: "numeric",
  month: "long",
});

const checkedFormatter = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZoneName: "short",
});

function displayDate(date: string) {
  return dateFormatter.format(new Date(`${date}T12:00:00+01:00`));
}

export default async function LagosDailyDeskPage() {
  const desk = await getDailyDeskReadModel();

  if (desk.status !== "ready") {
    return (
      <main className={styles.emptyPage}>
        <section className={styles.emptyState}>
          <p className={styles.kicker}>Lagos daily desk</p>
          <p className={styles.date}>{displayDate(desk.date)}</p>
          <h1>Today’s note is being checked.</h1>
          <p>
            We only put a price story here after its product, source and current
            Nigerian listing evidence pass review.
          </p>
          <Link className={styles.guideLink} href="/concerns">
            Explore skin guides <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <div>
          <p className={styles.kicker}>Lagos daily desk</p>
          <h1>One useful price note.</h1>
        </div>
        <time className={styles.date} dateTime={desk.date}>
          {displayDate(desk.date)}
        </time>
      </header>

      <article className={styles.feature}>
        <figure className={styles.storyFrame}>
          {/* The immutable campaign story has already been rendered and asset-verified. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={desk.image.url}
            alt={`${desk.product.brand} ${desk.product.name} daily price story`}
            width={desk.image.width}
            height={desk.image.height}
          />
        </figure>

        <section className={styles.note}>
          <p className={styles.noteLabel}>Today’s price context</p>
          <h2>{desk.copy.headline}</h2>
          <p className={styles.productLine}>{desk.copy.productLine}</p>
          <p className={styles.priceLine}>{desk.copy.priceLine}</p>
          <DailyDeskMeasurement
            campaignId={desk.campaignId}
            actionUrl={desk.actionUrl}
            actionLabel={desk.copy.action}
            className={styles.action}
          />
          <div className={styles.evidenceNote}>
            <p>{desk.copy.disclaimer}</p>
            <p>
              {desk.evidence.offerCount} current Nigerian
              {desk.evidence.offerCount === 1 ? " listing" : " listings"} ·
              checked{" "}
              {checkedFormatter.format(new Date(desk.evidence.dataCheckedAt))}
            </p>
          </div>
        </section>
      </article>

      <div className={styles.boundary}>
        <p>{desk.evidence.boundary}</p>
        <p>
          Price context, not a sale or suitability claim. A listing is not proof
          a product is genuine.
        </p>
      </div>

      <ConcernCards productSlug={desk.product.slug} />
    </main>
  );
}

function ConcernCards({ productSlug }: { productSlug: string }) {
  const linked = concernsLinkedToProduct(productSlug);
  const concerns = linked.length > 0 ? linked : allConcernSummaries();
  const isLinked = linked.length > 0;

  return (
    <section className={styles.concernSection}>
      <div className={styles.concernHeader}>
        <p className={styles.kicker}>
          {isLinked ? "Skin guides for this product" : "Skin guides"}
        </p>
        <h2 className={styles.concernHeading}>
          {isLinked ? "What it helps with." : "Browse all guides."}
        </h2>
        <p className={styles.concernIntro}>
          Downloadable story cards you can save and share.
        </p>
      </div>
      <div className={styles.concernRail}>
        {concerns.map((concern) => (
          <article key={concern.slug} className={styles.concernCard}>
            <Link
              href={`/concerns/${concern.slug}`}
              className={styles.concernCardImage}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/share/concern/${concern.slug}`}
                alt={`${concern.name} — skin guide story card`}
                width={540}
                height={960}
                loading="lazy"
              />
            </Link>
            <a
              href={`/share/concern/${concern.slug}`}
              download
              className={styles.concernCardDownload}
            >
              <Download size={14} aria-hidden="true" /> {concern.name}
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
