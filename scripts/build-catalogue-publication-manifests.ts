import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CatalogueIntakeManifest } from '../lib/catalogue/intake-readiness';
import type { CataloguePublicationDossierManifest } from '../lib/catalogue/publication-dossier';
import type { CataloguePublicationReleaseManifest } from '../lib/catalogue/publication-release';
import {
  assertCataloguePublicationWriteBoundary,
  cataloguePublicationBytesSha256,
  cataloguePublicationProjectionDiff,
  cataloguePublicationSourceSnapshotSha256,
  compileCataloguePublicationSources,
  readCataloguePublicationSourceFiles,
  stableCataloguePublicationJson,
  writeCataloguePublicationProjectionsAtomically,
} from '../lib/catalogue/publication-source';

type Options = {
  write: boolean;
  json: boolean;
};

function optionsFrom(argv: readonly string[]): Options {
  const allowed = new Set(['--write', '--json']);
  const unexpected = argv.filter(argument => !allowed.has(argument));
  if (unexpected.length) throw new Error(`Unknown arguments: ${unexpected.join(', ')}`);
  for (const argument of allowed) {
    if (argv.filter(value => value === argument).length > 1) {
      throw new Error(`Duplicate argument: ${argument}`);
    }
  }
  return {
    write: argv.includes('--write'),
    json: argv.includes('--json'),
  };
}

async function main() {
  const options = optionsFrom(process.argv.slice(2));
  const repositoryRoot = process.cwd();
  const asOf = Date.now();
  const intakePath = path.resolve(repositoryRoot, 'data/catalogue-intake.json');
  const dossierPath = path.resolve(
    repositoryRoot,
    'data/catalogue-publication-dossiers.json',
  );
  const releasePath = path.resolve(
    repositoryRoot,
    'data/catalogue-publication-releases.json',
  );
  const [
    intakeBytes,
    dossierBytes,
    releaseBytes,
    sourceFiles,
  ] = await Promise.all([
    readFile(intakePath, 'utf8'),
    readFile(dossierPath, 'utf8'),
    readFile(releasePath, 'utf8'),
    readCataloguePublicationSourceFiles(repositoryRoot),
  ]);
  const intake = JSON.parse(intakeBytes) as CatalogueIntakeManifest;
  const currentDossiers = JSON.parse(dossierBytes) as CataloguePublicationDossierManifest;
  const currentReleases = JSON.parse(releaseBytes) as CataloguePublicationReleaseManifest;
  const compilation = compileCataloguePublicationSources(
    intake.candidates,
    sourceFiles,
    asOf,
  );
  const diff = cataloguePublicationProjectionDiff(
    currentDossiers,
    currentReleases,
    compilation,
  );
  assertCataloguePublicationWriteBoundary(diff);
  const changed = (
    stableCataloguePublicationJson(currentDossiers)
      !== stableCataloguePublicationJson(compilation.dossierManifest)
    || stableCataloguePublicationJson(currentReleases)
      !== stableCataloguePublicationJson(compilation.releaseManifest)
  );

  if (options.write && changed) {
    await writeCataloguePublicationProjectionsAtomically({
      repositoryRoot,
      dossierManifest: compilation.dossierManifest,
      releaseManifest: compilation.releaseManifest,
      expectedDossierProjectionSha256: cataloguePublicationBytesSha256(dossierBytes),
      expectedReleaseProjectionSha256: cataloguePublicationBytesSha256(releaseBytes),
      expectedSourceSnapshotSha256: cataloguePublicationSourceSnapshotSha256(sourceFiles),
    });
  }

  const report = {
    mode: options.write ? 'write' : 'dry-run',
    changed,
    wroteProjections: options.write && changed,
    sourceDirectory: 'data/catalogue-publication-sources',
    dossierProjection: 'data/catalogue-publication-dossiers.json',
    releaseProjection: 'data/catalogue-publication-releases.json',
    sourceCount: compilation.sources.length,
    dossierCount: compilation.dossierManifest.dossiers.length,
    releaseCount: compilation.releaseManifest.releases.length,
    diff,
  };
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `${options.write ? 'Write' : 'Dry-run'} verified ${report.sourceCount} immutable per-SKU publication sources.`,
  );
  console.log(
    `${report.dossierCount} dossiers · ${report.releaseCount} releases · `
      + `${diff.changedOrNewCount} changed/new.`,
  );
  if (!options.write) {
    console.log(changed
      ? 'Projections differ. Review this report, then repeat with --write.'
      : 'Both projections already match; no write is needed.');
  } else {
    console.log(changed
      ? 'Both projections were replaced under one CAS lock.'
      : 'Both projections already matched; no file was rewritten.');
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
