import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import dossierManifest from "@/data/catalogue-publication-dossiers.json";
import releaseManifest from "@/data/catalogue-publication-releases.json";
import { catalogueIntakeCandidates } from "@/data/catalogue-intake";
import { verifyCataloguePublicationDossierManifestWithArtifacts } from "@/lib/catalogue/publication-dossier";
import { verifyCataloguePublicationReleaseManifestWithArtifacts } from "@/lib/catalogue/publication-release";

test("publication preflight fails closed when retained artifacts cannot be reopened", async () => {
  const emptyRoot = await mkdtemp(
    path.join(os.tmpdir(), "jelocare-publication-boundary-"),
  );
  try {
    await assert.rejects(
      () =>
        verifyCataloguePublicationDossierManifestWithArtifacts(
          catalogueIntakeCandidates,
          dossierManifest,
          { repositoryRoot: emptyRoot },
        ),
      /ENOENT/,
    );
    await assert.rejects(
      () =>
        verifyCataloguePublicationReleaseManifestWithArtifacts(
          catalogueIntakeCandidates,
          dossierManifest,
          releaseManifest,
          { repositoryRoot: emptyRoot },
        ),
      /ENOENT/,
    );
  } finally {
    await rm(emptyRoot, { recursive: true, force: true });
  }
});

test("production release entrypoints use artifact-aware constructors and verifiers", async () => {
  const [releaseCommand, dossierGate, releaseGate, imageGate] =
    await Promise.all([
      readFile(
        path.join(process.cwd(), "scripts/release-catalogue-candidate.ts"),
        "utf8",
      ),
      readFile(
        path.join(
          process.cwd(),
          "scripts/verify-catalogue-publication-dossiers.ts",
        ),
        "utf8",
      ),
      readFile(
        path.join(
          process.cwd(),
          "scripts/verify-catalogue-publication-releases.ts",
        ),
        "utf8",
      ),
      readFile(
        path.join(
          process.cwd(),
          "scripts/verify-catalogue-publication-images.ts",
        ),
        "utf8",
      ),
    ]);

  assert.match(releaseCommand, /createVerifiedCataloguePublicationDossier/);
  assert.match(releaseCommand, /createVerifiedCataloguePublicationRelease/);
  assert.match(
    dossierGate,
    /verifyCataloguePublicationDossierManifestWithArtifacts/,
  );
  assert.match(
    releaseGate,
    /verifyCataloguePublicationReleaseManifestWithArtifacts/,
  );
  assert.match(
    imageGate,
    /verifyCataloguePublicationDossierManifestWithArtifacts/,
  );
});

test("structural compiler APIs remain separate from artifact-bound publication preflight", async () => {
  const compiler = await readFile(
    path.join(process.cwd(), "lib/catalogue/publication-source.ts"),
    "utf8",
  );
  assert.match(compiler, /verifyCataloguePublicationDossierManifest/);
  assert.match(compiler, /verifyCataloguePublicationReleaseManifest/);
  assert.doesNotMatch(compiler, /WithArtifacts/);
});

test("release verification keeps the secondary cross-route package collision guard", async () => {
  const releaseVerifier = await readFile(
    path.join(process.cwd(), "lib/catalogue/publication-release.ts"),
    "utf8",
  );
  assert.match(
    releaseVerifier,
    /catalogueOfficialProductRoutePackageKey\(\s*officialProductCrosswalk,?\s*\)/,
  );
  assert.match(
    releaseVerifier,
    /existingRouteClass\s*!==\s*["']manufacturer-sku["'][\s\S]*routeClass\s*!==\s*["']manufacturer-sku["']/,
  );
  assert.match(
    releaseVerifier,
    /duplicates another released official route\/package across identity routes/,
  );
});
