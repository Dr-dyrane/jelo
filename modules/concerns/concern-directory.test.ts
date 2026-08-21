import assert from "node:assert/strict";
import test from "node:test";
import type { Concern } from "../../data/knowledge";
import {
  buildConcernDirectory,
  concernIsOutsideInitialDirectory,
  INITIAL_CONCERN_DIRECTORY_COUNT,
} from "../../components/concerns/concern-directory";

function makeConcern(index: number, area: Concern["area"] = "Face"): Concern {
  return {
    kind: "concern",
    slug: `concern-${index}`,
    name: `Concern ${index}`,
    area,
    summary: `Signal ${index}`,
    signals: [`signal ${index}`],
    ingredients: [`ingredient ${index}`],
    productTerms: [],
    escalation: "Escalate when needed.",
    sources: [],
    reviewedAt: "2026-08-21",
  };
}

const concerns = Array.from({ length: 14 }, (_, index) =>
  makeConcern(index + 1, index === 12 ? "Body" : "Face"),
);

test("the default concern directory renders a useful bounded first set", () => {
  const directory = buildConcernDirectory({
    concerns,
    query: "",
    area: "All",
    expanded: false,
    selectedSlugs: [],
  });

  assert.equal(directory.visibleConcerns.length, 14);
  assert.equal(
    directory.displayedConcerns.length,
    INITIAL_CONCERN_DIRECTORY_COUNT,
  );
  assert.equal(directory.showAll, false);
});

test("search, filters, explicit expansion and hidden selections reveal matches", () => {
  const searched = buildConcernDirectory({
    concerns,
    query: "signal 14",
    area: "All",
    expanded: false,
    selectedSlugs: [],
  });
  assert.deepEqual(
    searched.displayedConcerns.map((concern) => concern.slug),
    ["concern-14"],
  );

  const filtered = buildConcernDirectory({
    concerns,
    query: "",
    area: "Body",
    expanded: false,
    selectedSlugs: [],
  });
  assert.deepEqual(
    filtered.displayedConcerns.map((concern) => concern.slug),
    ["concern-13"],
  );

  const expanded = buildConcernDirectory({
    concerns,
    query: "",
    area: "All",
    expanded: true,
    selectedSlugs: [],
  });
  assert.equal(expanded.displayedConcerns.length, concerns.length);

  const selected = buildConcernDirectory({
    concerns,
    query: "",
    area: "All",
    expanded: false,
    selectedSlugs: ["concern-14"],
  });
  assert.equal(selected.displayedConcerns.length, concerns.length);
  assert.equal(selected.hasHiddenSelection, true);

  const persistExpanded = concernIsOutsideInitialDirectory(
    concerns,
    "concern-14",
  );
  const afterDeselect = buildConcernDirectory({
    concerns,
    query: "",
    area: "All",
    expanded: persistExpanded,
    selectedSlugs: [],
  });
  assert.equal(afterDeselect.showAll, true);
  assert.equal(afterDeselect.displayedConcerns.length, concerns.length);
});
