import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { LEGACY_SHELF_IMPORT_MANIFEST } from './legacy-shelf-import-manifest';

type LegacyProduct = {
  id: string;
  brand: string;
  name: string;
  size: string;
  category: string;
  step: string;
  purpose: string;
  usage: string;
  priority: string;
  primary: {
    label: string;
    url: string;
  };
};

function sha256(value: Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

export function verifyLegacyShelfImportSource(
  productsSource: Uint8Array,
  routineSource: Uint8Array,
) {
  const manifest = LEGACY_SHELF_IMPORT_MANIFEST;
  if (sha256(productsSource) !== manifest.source.products.sha256) {
    throw new Error('Legacy Shelf products source does not match its reviewed hash.');
  }
  if (sha256(routineSource) !== manifest.source.routine.sha256) {
    throw new Error('Legacy Shelf routine source does not match its reviewed hash.');
  }

  const parsed = JSON.parse(Buffer.from(productsSource).toString('utf8')) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Legacy Shelf products source is malformed.');
  const products = parsed as LegacyProduct[];
  const sourceIds = products.map(product => product.id);
  if (JSON.stringify(sourceIds) !== JSON.stringify(manifest.source.products.legacyIds)) {
    throw new Error('Legacy Shelf source IDs do not match the reviewed manifest.');
  }

  const classifiedIds = [
    ...manifest.accepted.map(item => item.legacyId),
    ...manifest.pendingRequests.map(item => item.legacyId),
  ];
  if (
    new Set(classifiedIds).size !== classifiedIds.length
    || classifiedIds.length !== sourceIds.length
    || sourceIds.some(id => !classifiedIds.includes(id as typeof classifiedIds[number]))
  ) {
    throw new Error('Every legacy Shelf source ID must be classified exactly once.');
  }

  const productsById = new Map(products.map(product => [product.id, product]));
  for (const binding of manifest.accepted) {
    const source = productsById.get(binding.legacyId);
    if (!source) throw new Error('A reviewed legacy Shelf binding is missing from its source.');
    const expectedSourceTuple = {
      brandAtReview: source.brand,
      variantAtReview: source.name,
      sizeAtReview: source.size,
    };
    const reviewedSourceTuple = {
      brandAtReview: binding.identityVersion.brandAtReview,
      variantAtReview: binding.identityVersion.variantAtReview,
      sizeAtReview: binding.identityVersion.sizeAtReview,
    };
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(binding.identityVersion.slugAtReview)
      || JSON.stringify(expectedSourceTuple) !== JSON.stringify(reviewedSourceTuple)
    ) {
      throw new Error('A reviewed legacy Shelf identity tuple drifted from its source.');
    }
    for (const key of ['category', 'step', 'purpose', 'usage', 'priority'] as const) {
      if (source[key] !== binding.provenance[key]) {
        throw new Error('Reviewed legacy Shelf provenance drifted from its source.');
      }
    }
  }

  for (const pending of manifest.pendingRequests) {
    const source = productsById.get(pending.legacyId);
    if (!source) throw new Error('A pending legacy product request is missing from its source.');
    if (
      source.brand !== pending.request.brand
      || source.name !== pending.request.fullPackName
      || source.size !== pending.request.printedSizeVariant
      || source.category !== pending.request.category
      || source.primary.label !== pending.request.retailerLabel
      || source.primary.url !== pending.request.sourceUrl
    ) {
      throw new Error('A pending legacy product request identity drifted from its source.');
    }
    for (const key of ['step', 'purpose', 'usage', 'priority'] as const) {
      if (source[key] !== pending.provenance[key]) {
        throw new Error('Pending legacy product request provenance drifted from its source.');
      }
    }
  }

  const routineText = Buffer.from(routineSource).toString('utf8');
  const sourceRoutineNames = [...routineText.matchAll(
    /data-routine="[^"]+">([^<]+)<\/button>/g,
  )].map(match => match[1]);
  const sourceRoutineSteps = [...routineText.matchAll(
    /\$\{step\("(\d{2})","([^"]+)","([^"]*)"\)\}/g,
  )].map(match => ({
    position: Number(match[1]),
    label: match[2],
    instruction: match[3],
  }));
  const reviewedRoutineSteps = manifest.routines.flatMap(routine => (
    routine.steps.map(({ position, label, instruction }) => ({
      position,
      label,
      instruction,
    }))
  ));
  if (
    JSON.stringify(sourceRoutineNames) !== JSON.stringify(manifest.routines.map(routine => routine.name))
    || JSON.stringify(sourceRoutineSteps) !== JSON.stringify(reviewedRoutineSteps)
  ) {
    throw new Error('Reviewed legacy routines drifted from their hashed source.');
  }
}

export function verifyLegacyShelfImportSourceFromGit(repositoryRoot = process.cwd()) {
  const { source } = LEGACY_SHELF_IMPORT_MANIFEST;
  const readHistoricalFile = (path: string) => execFileSync(
    'git',
    ['show', `${source.commit}:${path}`],
    {
      cwd: repositoryRoot,
      encoding: 'buffer',
      maxBuffer: 8 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    },
  );
  verifyLegacyShelfImportSource(
    readHistoricalFile(source.products.path),
    readHistoricalFile(source.routine.path),
  );
}
