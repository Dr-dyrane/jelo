import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const observationSource = readFileSync(
  join(root, "app/(ops)/ops/observations/ObservationsInbox.tsx"),
  "utf8",
);
const observationStyles = readFileSync(
  join(root, "app/(ops)/ops/observations/observations.module.css"),
  "utf8",
);
const observationLoading = readFileSync(
  join(root, "app/(ops)/ops/observations/loading.tsx"),
  "utf8",
);
const observationDetailSkeleton = readFileSync(
  join(root, "app/(ops)/ops/observations/ObservationDetailSkeleton.tsx"),
  "utf8",
);
const inboxSource = readFileSync(
  join(root, "components/ops/inbox/InboxContainer.tsx"),
  "utf8",
);
const inboxStyles = readFileSync(
  join(root, "components/ops/inbox/inbox.module.css"),
  "utf8",
);
const selectionSource = readFileSync(
  join(root, "components/ops/inbox/use-url-inbox-selection.ts"),
  "utf8",
);
const shareStyles = readFileSync(
  join(root, "app/(site)/share/share-index.module.css"),
  "utf8",
);

function cssRule(source: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

describe("Observation list visual integrity", () => {
  it("keeps rows transparent while giving packshots one restrained media stage", () => {
    assert.match(
      shareStyles,
      /packshot renders straight onto the card, no nested container/i,
    );

    for (const selector of [".featureCard", ".compactRow", ".experienceCard"]) {
      const rule = cssRule(observationStyles, selector);
      assert.ok(rule, `${selector} must remain defined`);
      assert.doesNotMatch(
        rule,
        /\bbackground\s*:/,
        `${selector} must stay transparent`,
      );
    }

    for (const selector of [
      ".featureVisual",
      ".compactImageStage",
      ".experienceVisual",
    ]) {
      const rule = cssRule(observationStyles, selector);
      assert.match(
        rule,
        /background:\s*color-mix\(in srgb,\s*var\(--ops-surface-subtle\)/,
      );
      assert.match(rule, /border-radius:/);
      assert.doesNotMatch(
        rule,
        /\bbox-shadow\s*:/,
        `${selector} must not become an independent card`,
      );
      assert.doesNotMatch(
        rule,
        /\bborder\s*:/,
        `${selector} must stay borderless`,
      );
    }
  });

  it("lets the shared interactive row own selected, hover, and focus state", () => {
    const baseRule = cssRule(inboxStyles, ".sectionItemButton");
    const activeRule = cssRule(inboxStyles, ".sectionItemButtonActive");

    assert.match(baseRule, /background:\s*transparent/);
    assert.match(activeRule, /background:\s*var\(--ops-action-subtle\)/);
    assert.doesNotMatch(observationSource, /selectedSurface/);
    assert.match(
      inboxSource,
      /className=\{`\$\{styles\.sectionItemButton\} \$\{isActive \? styles\.sectionItemButtonActive/,
    );
    assert.match(
      inboxSource,
      /aria-current=\{isActive \? 'true' : undefined\}/,
    );
    assert.match(inboxSource, /tabIndex=\{isKeyboardCurrent \? 0 : -1\}/);
  });

  it("keeps compact packshots legible inside the same restrained media-stage grammar", () => {
    const stageRule = cssRule(observationStyles, ".compactImageStage");
    const imageRule = cssRule(observationStyles, ".compactImage");

    assert.match(stageRule, /width:\s*52px/);
    assert.match(stageRule, /height:\s*52px/);
    assert.match(
      stageRule,
      /background:\s*color-mix\(in srgb,\s*var\(--ops-surface-subtle\)/,
    );
    assert.match(stageRule, /border-radius:/);
    assert.match(imageRule, /padding:\s*2px/);
  });

  it("keeps one fixed experience-card measure at every viewport", () => {
    assert.match(inboxStyles, /grid-auto-columns:\s*220px/);
    assert.strictEqual(
      inboxStyles.match(/grid-auto-columns:/g)?.length,
      1,
      "responsive bands must reveal more or fewer cards without resizing them",
    );
  });

  it("keeps loading geometry paired with each ready-state observation presentation", () => {
    const loadingSurfaceRule = cssRule(
      inboxStyles,
      ".skeletonSectionItemButton",
    );

    assert.match(loadingSurfaceRule, /--ops-skeleton-surface:\s*color-mix/);
    assert.strictEqual(
      observationLoading.match(/skeletonSectionItemButton/g)?.length,
      3,
      "each loading presentation must retain the same transparent row wrapper",
    );
    assert.match(
      observationLoading,
      /featureCard[\s\S]*featureVisual[\s\S]*skeletonFeatureProduct/,
    );
    assert.match(observationLoading, /compactRow[\s\S]*skeletonCompactImage/);
    assert.match(
      observationLoading,
      /experienceCard[\s\S]*experienceVisual[\s\S]*skeletonExperienceProduct/,
    );
    assert.match(observationLoading, /import \{ ObservationDetailSkeleton \}/);
    assert.match(observationDetailSkeleton, /data-observation-detail-loading/);
    assert.match(
      observationDetailSkeleton,
      /aria-label=\{announce \? 'Loading observation details' : undefined\}/,
    );
  });

  it("acknowledges selection before URL navigation finishes", () => {
    assert.match(observationSource, /useUrlInboxSelection\(\)/);
    assert.match(selectionSource, /useOptimistic\(/);
    assert.match(
      selectionSource,
      /startSelectionTransition\(\(\) => \{[\s\S]*setOptimisticSelectedId\(nextId\);[\s\S]*router\.replace/,
    );
    assert.match(
      selectionSource,
      /isSelectionPending && selectedId !== routeSelectedId/,
    );
    assert.match(
      observationSource,
      /pendingSelectionId=\{selection\.pendingSelectionId\}/,
    );
    assert.match(
      observationSource,
      /selection\.pendingSelectionId === row\.id[\s\S]*<ObservationDetailSkeleton/,
    );
    assert.match(
      inboxSource,
      /aria-busy=\{pendingSelectionId === item\.id \? 'true' : undefined\}/,
    );
  });
});

describe("Observation list progressive loading integrity", () => {
  it("uses a deduped observer threshold with a keyboard fallback and live status", () => {
    assert.match(inboxSource, /new IntersectionObserver/);
    assert.match(inboxSource, /loadPendingRef\.current/);
    assert.match(inboxSource, /onClick=\{showMore\}/);
    assert.match(inboxSource, />\s*Show more\s*<\/button>/);
    assert.match(inboxSource, /role="status"/);
    assert.match(inboxSource, /aria-live="polite"/);
    assert.match(inboxSource, /aria-atomic="true"/);
  });

  it("keeps the initial observation reveal deliberately small", () => {
    assert.match(observationSource, /initialCount:\s*8,[\s\S]*pageSize:\s*8/);
    assert.match(observationSource, /initialCount:\s*5,[\s\S]*pageSize:\s*5/);
  });
});
