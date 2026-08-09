import type { Metadata } from "next";
import { GlobalSearchExperience } from "@/components/search/global-search-experience";
import {
  globalSearchTypes,
  type GlobalSearchFilter,
} from "@/lib/search/global-search-index";
import { buildGlobalSearchRepository } from "@/lib/search/global-search-repository";

export const metadata: Metadata = {
  title: "Search | JeloCare",
  description:
    "Search JeloCare products, reviewed guides, ingredients, companies and retailer sources.",
  alternates: { canonical: "/search" },
};

type SearchParams = { q?: string | string[]; type?: string | string[] };

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = first(params.q).slice(0, 120);
  const requestedFilter = first(params.type);
  const filter: GlobalSearchFilter = globalSearchTypes.includes(
    requestedFilter as GlobalSearchFilter,
  )
    ? (requestedFilter as GlobalSearchFilter)
    : "all";
  const repository = buildGlobalSearchRepository();

  return (
    <GlobalSearchExperience
      key={`${query}:${filter}`}
      entries={repository.entries}
      categories={repository.categories}
      starters={repository.starters}
      initialQuery={query}
      initialFilter={filter}
    />
  );
}
