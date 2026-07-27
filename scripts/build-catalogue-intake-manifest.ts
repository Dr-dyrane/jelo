import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assertCatalogueIntakeWriteBoundary,
  catalogueIntakeBytesSha256,
  catalogueIntakeProjectionDiff,
  catalogueIntakeSourceSnapshotSha256,
  compileCatalogueIntakeSources,
  readCatalogueIntakeSourceFiles,
  stableCatalogueJson,
  validateCatalogueIntakeCompilation,
  writeCatalogueIntakeProjectionAtomically,
} from '../lib/catalogue/intake-source';
import {
  auditCatalogueIntakeManifest,
  type CatalogueIntakeManifest,
} from '../lib/catalogue/intake-readiness';

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

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

function intakeManifest(value: unknown, asOf: number): CatalogueIntakeManifest {
  auditCatalogueIntakeManifest(value as CatalogueIntakeManifest, asOf);
  return value as CatalogueIntakeManifest;
}

async function main() {
  const options = optionsFrom(process.argv.slice(2));
  const repositoryRoot = process.cwd();
  const asOf = Date.now();
  const projectionPath = path.resolve(repositoryRoot, 'data/catalogue-intake.json');
  const dossierPath = path.resolve(repositoryRoot, 'data/catalogue-publication-dossiers.json');
  const releasePath = path.resolve(repositoryRoot, 'data/catalogue-publication-releases.json');

  const [sourceFiles, currentProjection, dossierManifest, releaseManifest] = await Promise.all([
    readCatalogueIntakeSourceFiles(repositoryRoot),
    readFile(projectionPath, 'utf8'),
    readJson(dossierPath),
    readJson(releasePath),
  ]);
  const current = intakeManifest(JSON.parse(currentProjection) as unknown, asOf);
  const compilation = compileCatalogueIntakeSources(sourceFiles, asOf);
  const diff = catalogueIntakeProjectionDiff(current, compilation.manifest);
  assertCatalogueIntakeWriteBoundary(diff, compilation);
  const validation = await validateCatalogueIntakeCompilation(
    compilation,
    dossierManifest,
    releaseManifest,
    repositoryRoot,
    asOf,
  );
  const changed = stableCatalogueJson(current) !== stableCatalogueJson(compilation.manifest);

  if (options.write && changed) {
    await writeCatalogueIntakeProjectionAtomically({
      repositoryRoot,
      manifest: compilation.manifest,
      expectedProjectionSha256: catalogueIntakeBytesSha256(currentProjection),
      expectedSourceSnapshotSha256: catalogueIntakeSourceSnapshotSha256(sourceFiles),
    });
  }

  const report = {
    mode: options.write ? 'write' : 'dry-run',
    changed,
    wroteProjection: options.write && changed,
    projection: 'data/catalogue-intake.json',
    sourceDirectory: 'data/catalogue-intake-candidates',
    diff,
    validation,
  };
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `${options.write ? 'Write' : 'Dry-run'} verified ${validation.candidateCount} private intake sources.`,
  );
  console.log(
    `${diff.changedOrNewCount} changed/new · ${diff.removedCandidateIds.length} removed · `
      + `${validation.identityArtifactCount} identity artifacts · ${validation.dossierCount} dossiers · `
      + `${validation.releaseCount} releases.`,
  );
  if (!options.write) {
    console.log(changed
      ? 'Projection differs. Review this report, then repeat with --write.'
      : 'Projection already matches; no write is needed.');
  } else {
    console.log(changed ? 'Projection replaced atomically.' : 'Projection already matched; no file was rewritten.');
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
