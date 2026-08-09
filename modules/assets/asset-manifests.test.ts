import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { products } from "@/data/catalogue";
import { expandedProducts } from "@/data/expanded-products";
import editorialAssets from "@/data/editorial-assets.json";
import publicationDossiers from "@/data/catalogue-publication-dossiers.json";
import {
  isProductDisplayApproved,
  productDisplayApprovals,
} from "@/data/product-display-approvals";
import productAssetPromotions from "@/data/product-asset-promotions.json";
import productAssets from "@/data/product-assets.json";
import { products as coreProducts } from "@/data/products";
import { publishedIntakeProducts } from "@/data/published-intake-products";
import { withheldProductAssets } from "@/data/withheld-product-assets";

const assetHost = "m6aftkbqbwtkxooa.public.blob.vercel-storage.com";
const allowedTypes = new Set([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const restoredPackshotCohort = {
  "abib-clear-spot-serum-7-325-30ml":
    "52db192d1210fa02fc863c1b7cf4150d00a43e634c69b502ad0b1dda45f3f035",
  "advanced-clinicals-vitamin-c-face-serum-52ml":
    "8b00eeefd4cd0707376a3a4b0b3b0bcc9a0fee344f25adc2842b1ecd30c77ac4",
  "cerave-foaming-facial-cleanser":
    "9997d844ef7cef928bc36682bf038bf44ad7ba2e589a461ac7019b74816a49d9",
  "cosrx-salicylic-acid-daily-gentle-cleanser":
    "4d3620eb731dc444e4504fcf0096dbd937cc8c4986d93cb4e1192bcee12de329",
  "dang-azelaic-acid-serum-30ml":
    "4042aa08f87c067d2d930d05f0f631f9175eb7e40beac8f112bf5c264f234b33",
  "facefacts-vitamin-c-brightening-jelly-cleanser-150ml":
    "70fe9c17e42e25f8309c8789e1a5a1782710cea5c700b5cff51e5354524883a8",
  "la-roche-posay-toleriane-double-repair-matte":
    "78b804a306e10225ac4b37e641b8466b381a7678dbd9e339c8f7944b889389fa",
  "la-roche-posay-toleriane-double-repair-spf30":
    "d167a20ff9c2e527ec5b12c75418fe878f3eb70fbc7108b540c349f1ae94fc78",
  "naturium-bio-lipid-restoring-body-lotion-14oz":
    "937f61145e90218cbd14752041f12f69e07877cc9866b20a8760edf4d5eef3c1",
  "naturium-glow-getter-multi-oil-body-scrub-8oz":
    "8332e654a48e9c6f02c8092a7543ea2447915711088bc0b83da7bb775aa931a6",
  "naturium-niacinamide-gel-cream-5-1-7oz":
    "b2774b52a5b573f5abee4cd228e1f8d7810c3ce073151b9deedf4bf586a91407",
  "naturium-plant-ceramide-rich-moisture-cream-1-7oz":
    "b0885243c3c1319bfbd1da7d633b69f72b3fbe778fdfc1d496f036277819ec10",
  "naturium-retinaldehyde-cream-serum-0-05-1-7oz":
    "04321945ad655034f3e7c30a5ca7cf318ac1750244fcc4d297cc40102677c4c3",
  "naturium-retinaldehyde-cream-serum-0-10-1-7oz":
    "e339b924ca12e42d3a8f25717f9969f3c67f38cefed96f3743bc9bc99a930198",
  "nineless-a-control-azelaic-acid-cream-50ml":
    "c9f45ea392074354061e973ee149c330e690838bc29121ef707ce0e132d89acb",
  "replenix-bp-10-acne-wash-aloe-vera-7oz":
    "384219249218df8bed92ac365b56fb0010eb57da423a854f31fceffc3e4b87df",
  "the-ordinary-azelaic-acid-suspension-10":
    "4de3dcc4e8b15336f3e7254f36157f65fcc47b3aa27aed87f384267a39d983df",
} as const;

test("the restored packshot cohort cannot silently regress to older or promotional media", () => {
  const publicProducts = new Map(
    products.map((product) => [product.slug, product]),
  );
  const activePromotionByTarget = new Map<
    string,
    {
      blobUrl: string;
      contentHash: string;
    }
  >();

  for (const promotion of productAssetPromotions) {
    if (!promotion.active) continue;
    const target =
      "productSlug" in promotion
        ? promotion.productSlug
        : promotion.destination === "publication"
          ? promotion.candidateId
          : undefined;
    if (target) activePromotionByTarget.set(target, promotion);
  }

  for (const [slug, approvedHash] of Object.entries(restoredPackshotCohort)) {
    const product = publicProducts.get(slug);
    const promotion = activePromotionByTarget.get(slug);
    assert.ok(
      product,
      `${slug}: restored product is missing from the public catalogue`,
    );
    assert.ok(
      promotion,
      `${slug}: restored packshot has no active publication record`,
    );
    assert.equal(
      promotion.contentHash,
      approvedHash,
      `${slug}: media changed; repeat exact-SKU and peach/pink/dark visual review before release`,
    );
    assert.equal(
      product.image,
      promotion.blobUrl,
      `${slug}: public catalogue is not bound to the approved restored packshot`,
    );
  }
});

test("only transparent canonical packshots enter public product surfaces", () => {
  const manifest = productAssets as Record<
    string,
    {
      sourceUrl: string;
      blobUrl: string;
      contentType: string;
      byteSize: number;
      width: number;
      height: number;
      hasAlpha: boolean;
      contentHash: string;
    }
  >;

  const sourceProducts = [...coreProducts, ...expandedProducts];
  const sourceBySlug = new Map(
    sourceProducts.map((product) => [product.slug, product]),
  );
  assert.deepEqual(
    [...Object.keys(manifest), ...Object.keys(withheldProductAssets)].sort(),
    sourceProducts.map((product) => product.slug).sort(),
  );

  const publicSlugs = new Set(products.map((product) => product.slug));
  const approvedSlugs = new Set(Object.keys(productDisplayApprovals));
  for (const slug of Object.keys(withheldProductAssets))
    assert.equal(publicSlugs.has(slug), false);
  for (const [slug, asset] of Object.entries(manifest)) {
    const product = sourceBySlug.get(slug);
    const displayReady =
      asset.hasAlpha &&
      Math.min(asset.width, asset.height) >= 1000 &&
      Boolean(product && isProductDisplayApproved(product, asset));
    assert.equal(publicSlugs.has(slug), displayReady, slug);
  }

  const releasedSlugs = new Set(
    publishedIntakeProducts.map((product) => product.slug),
  );
  assert.deepEqual(
    [...publicSlugs].sort(),
    [...approvedSlugs, ...releasedSlugs].sort(),
  );
  for (const [slug, approval] of Object.entries(productDisplayApprovals)) {
    const product = sourceBySlug.get(slug);
    assert.ok(product, slug);
    assert.equal(
      manifest[slug]?.contentHash,
      approval.artReview.contentHash,
      slug,
    );
    assert.equal(
      manifest[slug]?.sourceUrl,
      approval.identityReview.sourceUrl,
      slug,
    );
    assert.equal(product.brand, approval.identityReview.brand, slug);
    assert.equal(product.name, approval.identityReview.name, slug);
    assert.equal(product.size, approval.identityReview.size, slug);
    assert.equal(approval.identityReview.reviewer, "Codex source audit");
    assert.equal(approval.artReview.reviewer, "Codex visual audit");
    assert.deepEqual(approval.artReview.surfaces, ["peach", "pink", "dark"]);
    assert.equal(approval.rightsStatus, "not-verified");
    assert.ok(!Number.isNaN(Date.parse(approval.identityReview.reviewedAt)));
    assert.ok(!Number.isNaN(Date.parse(approval.artReview.reviewedAt)));
  }

  for (const product of products) {
    const asset = manifest[product.slug];
    const releasedDossier = publicationDossiers.dossiers.find(
      (dossier) => dossier.candidateId === product.slug,
    );
    assert.ok(asset || releasedDossier, product.slug);
    const imageUrl = asset?.blobUrl ?? releasedDossier!.finalImage.url;
    const url = new URL(imageUrl);
    assert.equal(url.hostname, assetHost);
    assert.equal(product.image, imageUrl);
    if (asset) {
      assert.match(
        url.pathname,
        new RegExp(
          `/products/[^/]+/${product.slug}/packshot(?:-v\\d+)?\\.(?:avif|jpg|png|webp)$`,
        ),
      );
      assert.equal(new URL(asset.sourceUrl).protocol, "https:");
      assert.ok(allowedTypes.has(asset.contentType));
      assert.ok(asset.byteSize > 0);
      assert.ok(asset.width > 0 && asset.height > 0);
      assert.equal(asset.hasAlpha, true);
      assert.ok(Math.min(asset.width, asset.height) >= 1000);
      assert.match(asset.contentHash, /^[0-9a-f]{64}$/);
    } else {
      assert.match(
        url.pathname,
        new RegExp(
          `/products/[^/]+/${product.slug}/packshot-v\\d+-[0-9a-f]{16}\\.(?:png|webp)$`,
        ),
      );
      assert.ok(allowedTypes.has(releasedDossier!.finalImage.mimeType));
      assert.ok(releasedDossier!.finalImage.byteSize > 0);
      assert.ok(
        Math.min(
          releasedDossier!.finalImage.width,
          releasedDossier!.finalImage.height,
        ) >= 1600,
      );
      assert.match(releasedDossier!.finalImage.sha256, /^[0-9a-f]{64}$/);
    }
  }

  for (const withheld of Object.values(withheldProductAssets)) {
    assert.equal(withheld.reason, "source-terms-prohibit-reuse");
    assert.equal(new URL(withheld.policyUrl).protocol, "https:");
    assert.ok(!Number.isNaN(Date.parse(withheld.reviewedAt)));
  }
});

test("generated editorial cutouts have real transparent pixels and durable records", async () => {
  const cutouts = editorialAssets.filter((asset) => asset.transparent);
  assert.ok(cutouts.length >= 5);

  for (const asset of editorialAssets) {
    const url = new URL(asset.blobUrl);
    assert.equal(url.hostname, assetHost);
    const file = path.join(
      process.cwd(),
      "public",
      asset.localPath.replace(/^\//, ""),
    );
    const [fileStat, metadata, statistics] = await Promise.all([
      stat(file),
      sharp(file).metadata(),
      sharp(file).stats(),
    ]);
    assert.equal(fileStat.size, asset.byteSize);
    assert.equal(metadata.width, asset.width);
    assert.equal(metadata.height, asset.height);
    if (asset.transparent) {
      assert.equal(asset.mimeType, "image/png");
      assert.equal(metadata.hasAlpha, true);
      assert.equal(statistics.isOpaque, false);
    }
  }
});

test("the runtime product fallback has a transparent canvas", async () => {
  const file = path.join(process.cwd(), "public", "product-placeholder.svg");
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const cornerAlpha = [
    data[3],
    data[(info.width - 1) * 4 + 3],
    data[(info.height - 1) * info.width * 4 + 3],
    data[(info.height * info.width - 1) * 4 + 3],
  ];
  assert.deepEqual(cornerAlpha, [0, 0, 0, 0]);
});
