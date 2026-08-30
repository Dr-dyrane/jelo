import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function readTypeScriptTree(root: string): Promise<string> {
  const chunks: string[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          await visit(target);
        } else if (/\.(?:ts|tsx)$/.test(entry.name)) {
          chunks.push(await readFile(target, "utf8"));
        }
      }),
    );
  }

  await visit(root);
  return chunks.join("\n");
}

test("the unauthenticated handoff collector and invalid event writer are absent", async () => {
  const collectorPath = path.join(process.cwd(), "app/api/handoff/route.ts");
  const writerPath = path.join(
    process.cwd(),
    "lib/analytics/handoff-events.ts",
  );

  await assert.rejects(access(collectorPath), { code: "ENOENT" });
  await assert.rejects(access(writerPath), { code: "ENOENT" });

  const runtimeSource = await Promise.all(
    ["app", "components", "lib"].map((directory) =>
      readTypeScriptTree(path.join(process.cwd(), directory)),
    ),
  );
  const source = runtimeSource.join("\n");

  assert.doesNotMatch(source, /\/api\/handoff/);
  assert.doesNotMatch(
    source,
    /handoff_(?:viewed|continue|alternative|cancelled)/,
  );
});

test("the outbound exact-offer choke point records store_click exactly once", async () => {
  const continueRoute = await readFile(
    path.join(process.cwd(), "app/(site)/go/continue/route.ts"),
    "utf8",
  );

  assert.equal(
    continueRoute.match(/recordStoreClick\s*\(/g)?.length,
    1,
    "the route must schedule one store_click write",
  );
  assert.match(
    continueRoute,
    /if \(offer\) \{[\s\S]*?after\(\(\) =>\s*recordStoreClick\(\{[\s\S]*?return NextResponse\.redirect\(/,
  );
  assert.match(
    continueRoute,
    /priceRank: offerPriceRank\(offer, summary, market\)/,
  );
  assert.match(continueRoute, /position,/);
  assert.doesNotMatch(continueRoute, /recordHandoffEvent|handoff_/);
});

test("handoff navigation, alternatives, cancellation, and focus remain local UI behavior", async () => {
  const handoffView = await readFile(
    path.join(process.cwd(), "components/commerce/handoff-view.tsx"),
    "utf8",
  );

  assert.match(handoffView, /continueLinkRef\.current\?\.focus/);
  assert.match(handoffView, /event\.key === ["']Escape["']/);
  assert.match(
    handoffView,
    /router\.push\(`\/products\/\$\{model\.productSlug\}`\)/,
  );
  assert.match(handoffView, /const continueHref = `\/go\/continue\?product=/);
  assert.match(
    handoffView,
    /const productHref = `\/products\/\$\{model\.productSlug\}`/,
  );
  assert.match(handoffView, /href=\{`\/go\?product=/);
  assert.doesNotMatch(handoffView, /\bfetch\s*\(/);
});
