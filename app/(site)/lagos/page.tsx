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
          <h1>Today&apos;s note is being checked.</h1>
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
      {/* 01 — Price story */}
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={desk.image.url}
            alt={`${desk.product.brand} ${desk.product.name} daily price story`}
            width={desk.image.width}
            height={desk.image.height}
          />
        </figure>

        <section className={styles.note}>
          <p className={styles.noteLabel}>Today&apos;s price context</p>
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

      {/* 02 — Concern guides (featured + grid) */}
      <ConcernSection productSlug={desk.product.slug} />

      {/* 03 — How to order */}
      <GuideSection
        kicker="How to order"
        heading="Four steps."
        intro="Find a product, add it to your basket, request a quote, and pay securely. We handle procurement and delivery."
        guideSlug="order"
        guideLabel="Order guide"
        ctaHref="/order"
        ctaLabel="Start an order"
      />

      {/* 04 — How to bundle */}
      <GuideSection
        kicker="How to bundle"
        heading="One routine."
        intro="Pick products from different retailers, build a compatible bundle, and get a single quote for everything."
        guideSlug="bundle"
        guideLabel="Bundle guide"
        ctaHref="/bundle"
        ctaLabel="Build a bundle"
      />
    </main>
  );
}

/**
 * Section 02 — Concern guides as featured + grid editorial.
 * One large featured concern card + a responsive grid of the rest.
 */
function ConcernSection({ productSlug }: { productSlug: string }) {
  const linked = concernsLinkedToProduct(productSlug);
  const all = linked.length > 0 ? linked : allConcernSummaries();
  const isLinked = linked.length > 0;

  // Featured = first concern (either product-linked or the first everyday concern)
  const featured = all[0];
  const rest = all.slice(1);

  if (!featured) return null;

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

      {/* Featured concern — large editorial tile */}
      <div className={styles.concernFeatured}>
        <Link
          href={`/concerns/${featured.slug}`}
          className={styles.concernFeaturedImage}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/share/concern/${featured.slug}`}
            alt={`${featured.name} — skin guide story card`}
            width={540}
            height={960}
            loading="lazy"
          />
        </Link>
        <div className={styles.concernFeaturedCopy}>
          <span className={styles.concernFeaturedArea}>{featured.area}</span>
          <h3 className={styles.concernFeaturedName}>{featured.name}</h3>
          <p className={styles.concernFeaturedSummary}>{featured.summary}</p>
          <div className={styles.concernFeaturedActions}>
            <Link
              href={`/concerns/${featured.slug}`}
              className={styles.concernFeaturedLink}
            >
              Read guide <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <a
              href={`/share/concern/${featured.slug}`}
              download
              className={styles.concernCardDownload}
            >
              <Download size={14} aria-hidden="true" /> Story card
            </a>
          </div>
        </div>
      </div>

      {/* Grid of remaining concerns */}
      <div className={styles.concernGrid}>
        {rest.map((concern) => (
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
            <div className={styles.concernCardMeta}>
              <span className={styles.concernCardArea}>{concern.area}</span>
              <span className={styles.concernCardName}>{concern.name}</span>
            </div>
            <a
              href={`/share/concern/${concern.slug}`}
              download
              className={styles.concernCardDownload}
            >
              <Download size={14} aria-hidden="true" /> Download
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

/**
 * Section 03/04 — Guide mockup with iPhone 17 device frame.
 * Shows the guide PNG and provides a download button + CTA.
 */
function GuideSection({
  kicker,
  heading,
  intro,
  guideSlug,
  guideLabel,
  ctaHref,
  ctaLabel,
}: {
  kicker: string;
  heading: string;
  intro: string;
  guideSlug: string;
  guideLabel: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <section className={styles.guideSection}>
      <div className={styles.guideCopy}>
        <p className={styles.kicker}>{kicker}</p>
        <h2 className={styles.guideHeading}>{heading}</h2>
        <p className={styles.guideIntro}>{intro}</p>
        <div className={styles.guideActions}>
          <Link href={ctaHref} className={styles.guideCta}>
            {ctaLabel} <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <a
            href={`/share/guide/${guideSlug}`}
            download
            className={styles.concernCardDownload}
          >
            <Download size={14} aria-hidden="true" /> {guideLabel}
          </a>
        </div>
      </div>
      <figure className={styles.guideFrame}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/share/guide/${guideSlug}`}
          alt={`${guideLabel} — iPhone mockup`}
          width={540}
          height={960}
          loading="lazy"
        />
      </figure>
    </section>
  );
}
