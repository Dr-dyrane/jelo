import { ConsultExperience } from "@/components/consult/consult-experience";
import { SafeEditorialImage } from "@/components/editorial/safe-editorial-image";
import { editorialAsset } from "@/data/editorial";
import { publicSocialMetadata, staticSocialCard } from "@/lib/og/social-card";
import styles from "./consult-page.module.css";

export const metadata = publicSocialMetadata(
  staticSocialCard("consult"),
  "/consult",
);

const storyAsset = editorialAsset("consult-self-check-story");

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ConsultPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const initialQuery = firstParam(params.q)?.trim().slice(0, 200) ?? "";
  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <p className="eyebrow">Ask JeloCare</p>
        <h1>Tell us what you notice.</h1>
        <p>
          Describe it in your own words. We’ll build a sourced care guide—not a
          diagnosis.
        </p>
      </header>
      <div className={styles.visual}>
        <SafeEditorialImage
          asset={storyAsset}
          alt={storyAsset.altText}
          priority
          sizes="(max-width: 620px) 100vw, 34vw"
        />
      </div>
      <div className={styles.experience}>
        <ConsultExperience initialQuery={initialQuery} />
      </div>
    </main>
  );
}
