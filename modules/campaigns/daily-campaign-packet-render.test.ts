import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { GET as renderCampaignStory } from "@/app/(site)/share/[slug]/story/route";
import { selectDailyCampaign } from "@/lib/campaigns/daily-campaign";

test("daily campaign selection emits the exact proof-use-remember render order", async () => {
  const selection = await selectDailyCampaign({
    now: new Date("2026-08-15T07:02:00Z"),
  });
  assert.equal(selection.status, "selected");
  if (selection.status !== "selected") return;

  const { creativePlan } = selection.draft;
  assert.deepEqual(
    creativePlan.packet.map((item) => item.role),
    ["proof", "use", "remember"],
  );
  assert.equal(creativePlan.packet[0].renderPath, creativePlan.renderPath);
  assert.match(creativePlan.packet[1].renderPath, /[?&]kind=price(?:&|$)/);
  assert.match(creativePlan.packet[1].renderPath, /[?&]variant=use(?:&|$)/);
  assert.match(creativePlan.packet[2].renderPath, /[?&]kind=price(?:&|$)/);
  assert.match(
    creativePlan.packet[2].renderPath,
    /[?&]variant=remember(?:&|$)/,
  );
});

test("story route rejects unknown packet variants before product resolution", async () => {
  const response = await renderCampaignStory(
    new Request(
      "http://localhost/share/not-a-product/story?kind=price&variant=unknown",
    ),
    { params: Promise.resolve({ slug: "not-a-product" }) },
  );
  assert.equal(response.status, 400);
  assert.equal(await response.text(), "Choose a valid campaign story variant.");
});

test("use and remember variants keep product media contained and their claims bounded", async () => {
  const [route, useStory, rememberStory] = await Promise.all([
    readFile(
      path.join(process.cwd(), "app/(site)/share/[slug]/story/route.tsx"),
      "utf8",
    ),
    readFile(
      path.join(
        process.cwd(),
        "lib/campaigns/daily-packet/mobile-comparison-story.tsx",
      ),
      "utf8",
    ),
    readFile(
      path.join(
        process.cwd(),
        "lib/campaigns/daily-packet/market-note-story.tsx",
      ),
      "utf8",
    ),
  ]);
  const source = `${useStory}\n${rememberStory}`;

  assert.match(route, /MobileComparisonStory/);
  assert.match(route, /MarketNoteStory/);
  assert.match(source, /function MobileComparisonStory/);
  assert.match(source, /function MarketNoteStory/);
  assert.match(source, /Compare current prices/);
  assert.match(source, /Reference only · Not a checkout/);
  assert.match(source, /Exact Nigerian listings/);
  assert.equal((source.match(/objectFit: "contain"/g) ?? []).length, 2);
  assert.doesNotMatch(source, /\b(?:sale|saving|save|guaranteed)\b/i);
});
