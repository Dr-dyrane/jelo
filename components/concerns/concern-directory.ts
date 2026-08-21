import type { Concern } from "@/data/knowledge";

export const INITIAL_CONCERN_DIRECTORY_COUNT = 10;

export type ConcernAreaFilter = "All" | Concern["area"];

export function concernIsOutsideInitialDirectory(
  concerns: readonly Concern[],
  slug: string,
) {
  const index = concerns.findIndex((concern) => concern.slug === slug);
  return index >= INITIAL_CONCERN_DIRECTORY_COUNT;
}

export function buildConcernDirectory({
  concerns,
  query,
  area,
  expanded,
  selectedSlugs,
}: {
  concerns: readonly Concern[];
  query: string;
  area: ConcernAreaFilter;
  expanded: boolean;
  selectedSlugs: readonly string[];
}) {
  const normalized = query.trim().toLowerCase();
  const visibleConcerns = concerns.filter((concern) => {
    if (area !== "All" && concern.area !== area) return false;
    if (!normalized) return true;
    return [
      concern.name,
      concern.area,
      concern.summary,
      ...concern.signals,
      ...concern.ingredients,
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalized);
  });

  const hasHiddenSelection = selectedSlugs.some((slug) =>
    concernIsOutsideInitialDirectory(concerns, slug),
  );
  const contextualExpansion =
    Boolean(normalized) || area !== "All" || hasHiddenSelection;
  const showAll = expanded || contextualExpansion;

  return {
    visibleConcerns,
    displayedConcerns: showAll
      ? visibleConcerns
      : visibleConcerns.slice(0, INITIAL_CONCERN_DIRECTORY_COUNT),
    showAll,
    hasHiddenSelection,
  };
}
