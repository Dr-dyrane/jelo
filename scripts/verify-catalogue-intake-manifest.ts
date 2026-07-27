import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  compileCatalogueIntakeSources,
  readCatalogueIntakeSourceFiles,
  stableCatalogueJson,
  validateCatalogueIntakeCompilation,
} from '../lib/catalogue/intake-source';
import {
  auditCatalogueIntakeManifest,
  type CatalogueIntakeManifest,
} from '../lib/catalogue/intake-readiness';

function optionsFrom(argv: readonly string[]) {
  const allowed = new Set(['--json']);
  const unexpected = argv.filter(argument => !allowed.has(argument));
  if (unexpected.length) throw new Error(`Unknown arguments: ${unexpected.join(', ')}`);
  if (argv.filter(argument => argument === '--json').length > 1) {
    throw new Error('Duplicate argument: --json');
  }
  return { json: argv.includes('--json') };
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

async function main() {
  const options = optionsFrom(process.argv.slice(2));
  const repositoryRoot = process.cwd();
  const asOf = Date.now();
  const [sourceFiles, projectionValue, dossierManifest, releaseManifest] = await Promise.all([
    readCatalogueIntakeSourceFiles(repositoryRoot),
    readJson(path.resolve(repositoryRoot, 'data/catalogue-intake.json')),
    readJson(path.resolve(repositoryRoot, 'data/catalogue-publication-dossiers.json')),
    readJson(path.resolve(repositoryRoot, 'data/catalogue-publication-releases.json')),
  ]);
  const projection = projectionValue as CatalogueIntakeManifest;
  auditCatalogueIntakeManifest(projection, asOf);
  const compilation = compileCatalogueIntakeSources(sourceFiles, asOf);
  if (stableCatalogueJson(projection) !== stableCatalogueJson(compilation.manifest)) {
    throw new Error(
      'Catalogue intake projection is stale. Run catalogue:intake:build, review, then use --write.',
    );
  }
  const validation = await validateCatalogueIntakeCompilation(
    compilation,
    dossierManifest,
    releaseManifest,
    repositoryRoot,
    asOf,
  );
  const report = {
    projectionMatches: true,
    sourceDirectory: 'data/catalogue-intake-candidates',
    projection: 'data/catalogue-intake.json',
    validation,
  };
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `Verified ${validation.candidateCount} per-SKU intake sources and their deterministic projection.`,
  );
  console.log(
    `${validation.identityArtifactCount} identity artifacts · ${validation.dossierCount} dossiers · `
      + `${validation.releaseCount} releases remain bound.`,
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
