import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Download,
  ExternalLink,
  PackageCheck,
  ReceiptText,
  Search,
  ShoppingBasket,
  Store,
  WalletCards,
} from "lucide-react";
import { DailyDeskMeasurement } from "@/components/campaigns/daily-desk-measurement";
import { getDailyDeskReadModel } from "@/lib/campaigns/daily-desk";
import { concernsLinkedToProduct } from "@/lib/clinical/concern-product-links";
import { publicSocialMetadata, staticSocialCard } from "@/lib/og/social-card";
import {
  lagosCommerceJourneys,
  type LagosJourney,
  type LagosJourneyIcon,
} from "./lagos-journeys";
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

const journeyIcons: Record<LagosJourneyIcon, LucideIcon> = {
  browse: Search,
  retailer: Store,
  quote: ReceiptText,
  payment: WalletCards,
  delivery: PackageCheck,
  products: ShoppingBasket,
  listings: ExternalLink,
};

function displayDate(date: string) {
  return dateFormatter.format(new Date(`${date}T12:00:00+01:00`));
}

export default async function LagosDailyDeskPage() {
  const desk = await getDailyDeskReadModel();

  if (desk.status !== "ready") {
    return (
      <main className={styles.emptyPage}>
        <section className={styles.emptyState}>
          <p className={styles.kicker}>Lagos</p>
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
      {/* 01 — Price story (full-bleed) */}
      <section className={styles.bleed}>
        <header className={styles.intro}>
          <div>
            <p className={styles.kicker}>Lagos</p>
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
            Price context, not a sale or suitability claim. A listing is not
            proof a product is genuine.
          </p>
        </div>
      </section>

      {/* 02 — Concern guides (full-bleed header + edge-to-edge rail) */}
      <ConcernSection productSlug={desk.product.slug} />

      {lagosCommerceJourneys.map((journey) => (
        <CommerceJourney key={journey.id} journey={journey} />
      ))}
    </main>
  );
}

function CommerceJourney({ journey }: { journey: LagosJourney }) {
  return (
    <section className={styles.section} aria-labelledby={`${journey.id}-title`}>
      <div className={styles.guideCopy}>
        <p className={styles.kicker}>{journey.eyebrow}</p>
        <h2 className={styles.guideHeading} id={`${journey.id}-title`}>
          {journey.heading}
        </h2>
        <p className={styles.guideIntro}>{journey.intro}</p>
        <div className={styles.guideActions}>
          <Link href={journey.href} className={styles.guideCta}>
            {journey.cta} <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className={styles.journeyPreview}>
        <div className={styles.journeyBar} aria-hidden="true">
          <span />
          <span>{journey.previewLabel}</span>
          <small>{journey.steps.length} steps</small>
        </div>
        <ol
          className={styles.journeyList}
          aria-label={`${journey.previewLabel} steps`}
        >
          {journey.steps.map((step, index) => {
            const Icon = journeyIcons[step.icon];
            return (
              <li className={styles.journeyStep} key={step.title}>
                <span className={styles.journeyIcon}>
                  <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <span className={styles.journeyStepCopy}>
                  <small>{String(index + 1).padStart(2, "0")}</small>
                  <strong>{step.title}</strong>
                  <span>{step.description}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/**
 * Section 02 — Concern guides as featured + rail.
 * Full-bleed section with inset header/featured and edge-to-edge rail.
 */
function ConcernSection({ productSlug }: { productSlug: string }) {
  const linked = concernsLinkedToProduct(productSlug);

  if (linked.length === 0) return null;

  const featured = linked[0];
  const rest = linked.slice(1);

  return (
    <section className={styles.concernSection}>
      <div className={styles.concernHeader}>
        <p className={styles.kicker}>Skin guides for this product</p>
        <h2 className={styles.concernHeading}>What it helps with.</h2>
        <p className={styles.concernIntro}>
          Downloadable story cards you can save and share.
        </p>
      </div>

      {/* Featured concern — inset */}
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

      {/* Rail — edge-to-edge */}
      <div className={styles.concernRail}>
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
