import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import manifest from "../data/catalogue-publication-dossiers.json";
import promotions from "../data/product-asset-promotions.json";
import { catalogueIntakeCandidates } from "../data/catalogue-intake";
import { verifyCataloguePublicationDossierManifestWithArtifacts } from "../lib/catalogue/publication-dossier";
import {
  verifyCataloguePublicationImageBytes,
  verifyRemoteCataloguePublicationImage,
} from "../lib/catalogue/publication-image-verification";

type PromotionRecord = {
  active?: boolean;
  candidateId?: string;
  destination?: string;
  blobUrl?: string;
  localPath?: string;
  contentType?: string;
  contentHash?: string;
};

// CI and non-production verification can run before promotion, so a brand-new
// promotion's public URL may not exist yet. A 404 is acceptable only when an
// active staged promotion binds the same URL and content hash and the staged
// local bytes pass the identical decode, alpha, edge and surface checks. The
// production promoter independently verifies the uploaded bytes remotely.
async function verifyStagedFallback(
  expectation: Parameters<typeof verifyRemoteCataloguePublicationImage>[0],
) {
  const promotion = (promotions as PromotionRecord[]).find(
    (record) =>
      record.active === true &&
      record.destination === "publication" &&
      record.candidateId === expectation.candidateId &&
      record.blobUrl === expectation.url,
  );
  if (!promotion?.localPath || promotion.contentHash !== expectation.sha256) {
    throw new Error(
      `${expectation.candidateId}: final image is missing and no matching staged promotion binds it.`,
    );
  }
  const bytes = await readFile(promotion.localPath);
  const localSha = createHash("sha256").update(bytes).digest("hex");
  if (localSha !== expectation.sha256) {
    throw new Error(
      `${expectation.candidateId}: staged bytes do not match the promoted content hash.`,
    );
  }
  const result = await verifyCataloguePublicationImageBytes(
    expectation,
    bytes,
    promotion.contentType ?? expectation.mimeType,
  );
  return {
    ...result,
    transport: "staged-local-bytes-pending-promotion" as const,
  };
}

async function verifyOne(
  expectation: Parameters<typeof verifyRemoteCataloguePublicationImage>[0],
) {
  try {
    return await verifyRemoteCataloguePublicationImage(expectation);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.endsWith("final image returned 404, not 200.")
    ) {
      return verifyStagedFallback(expectation);
    }
    throw error;
  }
}

async function main() {
  const structural =
    await verifyCataloguePublicationDossierManifestWithArtifacts(
      catalogueIntakeCandidates,
      manifest,
    );
  const verified = [];
  const concurrency = 2;
  for (
    let offset = 0;
    offset < structural.dossiers.length;
    offset += concurrency
  ) {
    const batch = structural.dossiers.slice(offset, offset + concurrency);
    verified.push(
      ...(await Promise.all(
        batch.map((dossier) =>
          verifyOne({
            candidateId: dossier.candidateId,
            ...dossier.finalImage,
          }),
        ),
      )),
    );
  }

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(verified, null, 2));
    return;
  }
  const staged = verified.filter(
    (result) =>
      (result as { transport?: string }).transport ===
      "staged-local-bytes-pending-promotion",
  );
  console.log(
    `Verified ${verified.length} private publication images by trusted URL, bytes, hash, decode, alpha, edges and surfaces.`,
  );
  if (staged.length) {
    console.log(
      `${staged.length} verified from staged local bytes awaiting promotion in this deployment.`,
    );
  }
  console.log(
    "Published 0 products. Remote image verification is evidence, not publication permission.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
