import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Clock3, ShieldCheck } from "lucide-react";
import { RetailerDirectory } from "@/components/retailers/retailer-directory";
import { RetailerPartnershipExperience } from "@/components/retailers/retailer-partnership-experience";
import { nigeriaRetailers, retailerSlug } from "@/data/retailers";
import { listCatalogueProducts } from "@/lib/catalogue/repository";
import { publicSocialMetadata, staticSocialCard } from "@/lib/og/social-card";
import { buildRetailerProfile } from "@/modules/commerce/retailer-profile";
import { hasRegulatorMatch } from "@/modules/commerce/offer-evidence";
import styles from "./retailers.module.css";

export const revalidate = 3600;

export const metadata: Metadata = publicSocialMetadata(
  staticSocialCard("retailers"),
  "/retailers",
);

const directCount = nigeriaRetailers.filter(
  (store) => store.kind === "retailer",
).length;

const standards = [
  { icon: BadgeCheck, title: "Matched", copy: "Product. Variant. Size." },
  { icon: Clock3, title: "Observed", copy: "Price. Stock. Time." },
  {
    icon: ShieldCheck,
    title: "Separate",
    copy: "Listing is not authenticity.",
  },
];

function brandId(value: string) {
  return `brand:${value
    .normalize("NFKD")
    .toLocaleLowerCase("en-NG")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

export default async function RetailersPage() {
  const catalogue = await listCatalogueProducts();
  const brands = [...new Set(catalogue.map((product) => product.brand))]
    .sort((left, right) => left.localeCompare(right))
    .map((label) => ({ id: brandId(label), label }));
  const directoryItems = nigeriaRetailers.map((store, index) => {
    const profile = buildRetailerProfile(store, catalogue);
    const evidenceNote = hasRegulatorMatch({
      reviewStatus: store.reviewStatus,
      contentUse: store.contentUse,
      identity: store.identityEvidence,
      regulatorMatch: store.regulatorMatchEvidence,
    })
      ? "Regulator number matched to an independent register."
      : store.identityEvidence
        ? "Self-published contact details observed. No regulator match."
        : store.kind === "marketplace"
          ? "Seller identity is checked per offer when evidence exists."
          : "No identity or regulator match recorded.";

    return {
      rank: index + 1,
      slug: retailerSlug(store.name),
      name: store.name,
      kind:
        store.reviewStatus === "provisional"
          ? "Provisional source"
          : store.kind === "marketplace"
            ? "Marketplace"
            : "Direct retailer",
      productCount: profile.productCount,
      evidenceNote,
      trust: store.trust,
      latestObservedAt: profile.latestObservedAt,
    };
  });

  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div>
          <p className="eyebrow">Retailer guide</p>
          <h1>
            Stores
            <br />
            we check.
          </h1>
          <p>Nigeria first. Exact products only.</p>
        </div>
        <div className={styles.metrics} aria-label="Retailer guide summary">
          <span>
            <strong>{nigeriaRetailers.length}</strong>
            <small>sources</small>
          </span>
          <span>
            <strong>{directCount}</strong>
            <small>direct</small>
          </span>
          <span>
            <strong>7d</strong>
            <small>maximum</small>
          </span>
        </div>
      </section>

      <section className={styles.directory}>
        <div className={styles.sectionHeading}>
          <p className="eyebrow">Nigeria</p>
          <h2>
            Reference
            <br />
            sources.
          </h2>
        </div>
        <RetailerDirectory items={directoryItems} />
      </section>

      <section className={styles.standardSection}>
        <div className={styles.sectionHeading}>
          <p className="eyebrow">A price means</p>
          <h2>
            Checked.
            <br />
            Not guessed.
          </h2>
        </div>
        <div className={styles.standards}>
          {standards.map(({ icon: Icon, title, copy }, index) => (
            <article key={title}>
              <span>0{index + 1}</span>
              <Icon size={22} />
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.partnership} id="list-your-store">
        <div className={styles.partnershipIntro}>
          <p className="eyebrow">For stores</p>
          <h2>
            Be easier
            <br />
            to find.
          </h2>
          <p>
            Physical or online. Start with the basics. Your private link keeps
            everything saved.
          </p>
          <div>
            <span>
              <strong>One step</strong>
              <small>at a time</small>
            </span>
            <span>
              <strong>No website</strong>
              <small>required</small>
            </span>
          </div>
        </div>
        <RetailerPartnershipExperience brands={brands} />
      </section>

      <section className={styles.disclosure}>
        <div>
          <p className="eyebrow">Our promise</p>
          <h2>Advice first.</h2>
          <p>A listing never proves authenticity.</p>
        </div>
        <div className={styles.disclosureActions}>
          <Link href="/products">
            Browse products <ArrowUpRight size={17} />
          </Link>
          <Link href="/retailers#list-your-store">List your store</Link>
        </div>
      </section>
    </main>
  );
}
