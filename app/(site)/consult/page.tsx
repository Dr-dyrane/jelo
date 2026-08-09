import { ConsultExperience } from "@/components/consult/consult-experience";
import { EditorialEntry } from "@/components/editorial/editorial-entry";
import { editorialAsset } from "@/data/editorial";
import { publicSocialMetadata, staticSocialCard } from "@/lib/og/social-card";

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
    <main className="consult-page">
      <EditorialEntry asset={storyAsset} layout="split" priority>
        <header className="consult-heading">
          <p className="eyebrow">Ask JeloCare</p>
          <h1>Tell us what your skin is doing.</h1>
          <p>
            Share what you notice in your own words. We’ll offer a simple,
            sourced care guide—not a diagnosis.
          </p>
        </header>
      </EditorialEntry>
      <ConsultExperience initialQuery={initialQuery} />
    </main>
  );
}
