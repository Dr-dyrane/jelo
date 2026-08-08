import sharp from "sharp";
import {
  externalCatalogueCandidates,
  externalCatalogueMetadata,
} from "../data/external-catalogue";
import {
  assertPublishedPackshotRelease,
  type PackshotReleaseProduct,
} from "../lib/catalogue/packshot-release";
import { sha256 } from "../lib/crypto/hashing";

const verifyRemote = process.argv.includes("--remote");
const researchPackshots =
  externalCatalogueCandidates as unknown as PackshotReleaseProduct[];

async function verifyProduct(product: PackshotReleaseProduct) {
  const response = await fetch(product.canonicalImageUrl, {
    signal: AbortSignal.timeout(25_000),
    headers: { Accept: "image/webp" },
  });
  if (!response.ok)
    throw new Error(`${product.barcode}: Blob returned ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (
    bytes.length !== product.imageByteSize ||
    sha256(bytes) !== product.imageSha256
  ) {
    throw new Error(
      `${product.barcode}: remote bytes do not match the reviewed release`,
    );
  }
  const [metadata, statistics] = await Promise.all([
    sharp(bytes).metadata(),
    sharp(bytes).ensureAlpha().stats(),
  ]);
  const alpha = statistics.channels[3];
  if (
    metadata.format !== "webp" ||
    metadata.width !== 1000 ||
    metadata.height !== 1000 ||
    !metadata.hasAlpha ||
    !alpha ||
    alpha.min !== 0 ||
    alpha.max !== 255
  ) {
    throw new Error(
      `${product.barcode}: remote Blob is not the reviewed transparent 1000 × 1000 WebP`,
    );
  }
}

async function main() {
  assertPublishedPackshotRelease(
    researchPackshots,
    externalCatalogueMetadata,
    977,
  );
  console.log(
    `Validated private research packshot release ${externalCatalogueMetadata.packshotReleaseSha256.slice(0, 12)} for 977 candidates.`,
  );
  if (!verifyRemote) return;
  const concurrency = 8;
  for (
    let offset = 0;
    offset < researchPackshots.length;
    offset += concurrency
  ) {
    await Promise.all(
      researchPackshots.slice(offset, offset + concurrency).map(verifyProduct),
    );
  }
  console.log(
    "Verified all 977 private research cutouts by bytes, hash, dimensions, format, and alpha.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
