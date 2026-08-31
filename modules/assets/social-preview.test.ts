import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import path from "node:path";

const root = process.cwd();

test("site metadata uses contextual cards instead of a generic root preview", async () => {
  const [layoutSource, homeSource, socialCardSource, packageSource] =
    await Promise.all([
      readFile(path.join(root, "app/layout.tsx"), "utf8"),
      readFile(path.join(root, "app/(site)/page.tsx"), "utf8"),
      readFile(path.join(root, "lib/og/social-card.tsx"), "utf8"),
      readFile(path.join(root, "package.json"), "utf8"),
    ]);
  const packageJson = JSON.parse(packageSource) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    overrides?: Record<string, string>;
  };

  assert.doesNotMatch(
    layoutSource,
    /jelocare-open-graph-v1|openGraph:|twitter:/,
  );
  assert.match(
    homeSource,
    /publicSocialMetadata\(staticSocialCard\(["']home["']\), ["']\/["']\)/,
  );
  assert.match(socialCardSource, /card: ["']summary_large_image["']/);
  assert.match(socialCardSource, /width: OG_SIZE\.width/);
  assert.match(socialCardSource, /height: OG_SIZE\.height/);
  assert.match(socialCardSource, /@\/lib\/og\/constants/);
  assert.doesNotMatch(socialCardSource, /@\/lib\/og\/assets/);
  assert.equal(packageJson.dependencies?.sharp, "0.35.4");
  assert.equal(packageJson.devDependencies?.sharp, undefined);
  assert.equal(packageJson.overrides?.sharp, undefined);
  assert.match(
    socialCardSource,
    /openGraph:[\s\S]*images: \[imageDescriptor\][\s\S]*twitter:[\s\S]*images: \[imageDescriptor\]/,
  );
});
