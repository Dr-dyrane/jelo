import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export const catalogueProductVisualRevisionSchemaVersion = 1 as const;
export const catalogueProductVisualRevisionExposure = 'private-catalogue-authority' as const;

type ExactVisualIdentity = {
  brand: string;
  canonicalName: string;
  variant: string;
  size: string;
};

export type CatalogueProductVisualRevision = {
  revisionId: string;
  candidateId: string;
  identity: ExactVisualIdentity;
  package: {
    observedState: 'current-at-capture' | 'historical-at-capture';
    description: string;
    effectiveAt: string | null;
    capturedAt: string;
    supersedesRevisionId: string | null;
  };
  asset: {
    role: 'packaging-continuity-evidence' | 'official-current-package-reference';
    publishable: boolean;
    immutablePath: string;
    sha256: string;
    mimeType: 'image/png' | 'image/webp';
    byteSize: number;
    width: number;
    height: number;
    subjectRegion: { left: number; top: number; right: number; bottom: number } | null;
  };
  provenance: {
    kind: 'official-brand-media' | 'founder-supplied-packaging-continuity-reference';
    sourceUrl: string | null;
    retainedAt: string;
    reuseBasis: 'private-identity-reference-only' | 'private-evidence-only';
  };
  review: {
    state: 'approved-reference-only' | 'evidence-only';
    reviewedAt: string;
    reviewer: string;
    notes: string;
  };
};

export type CatalogueRejectedVisualCandidate = {
  candidateAssetId: string;
  candidateId: string;
  identity: ExactVisualIdentity;
  immutablePath: string;
  sha256: string;
  mimeType: 'image/png' | 'image/webp';
  byteSize: number;
  width: number;
  height: number;
  provenance: {
    kind: 'founder-supplied-candidate';
    sourceUrl: string | null;
    retainedAt: string;
    reuseBasis: 'unknown-not-publishable';
  };
  review: {
    state: 'rejected';
    reviewedAt: string;
    reviewer: string;
    reasons: string[];
  };
};

export type CatalogueProductVisualRevisionManifest = {
  schemaVersion: typeof catalogueProductVisualRevisionSchemaVersion;
  exposure: typeof catalogueProductVisualRevisionExposure;
  revisions: CatalogueProductVisualRevision[];
  rejectedCandidateAssets: CatalogueRejectedVisualCandidate[];
};

export type CataloguePackageRevisionEquivalence = {
  equivalenceId: string;
  candidateId: string;
  brand: string;
  canonicalName: string;
  variant: string;
  size: string;
  currentPackageRevisionId: string;
  historicalPackageRevisionId: string;
  relationship: 'same-formula-new-look';
  permittedUse: 'historical-retailer-package-image-match';
  publicationAuthority: 'none';
  displayDisclosure: 'Packaging may vary';
  officialEvidence: {
    sourceUrl: string;
    sourceHost: string;
    retrievedAt: string;
    effectiveAt: string | null;
    retainedPath: string;
    responseMimeType: 'text/html';
    responseByteSize: number;
    responseSha256: string;
    recordStartByte: number;
    recordEndByte: number;
    recordSha256: string;
    officialProductId: string;
    officialDisplayName: string;
    officialImageFilename: string;
    equivalenceStatement: 'Same Formula, New Look';
    requiredRecordText: string[];
  };
  reviewState: 'approved';
  reviewedAt: string;
  reviewer: string;
};

export type CataloguePackageRevisionEquivalenceManifest = {
  schemaVersion: 1;
  exposure: typeof catalogueProductVisualRevisionExposure;
  equivalences: CataloguePackageRevisionEquivalence[];
};

export type HistoricalPackageMatchInput = {
  candidateId: string;
  brand: string;
  canonicalName: string;
  variant: string;
  size: string;
  currentPackageRevisionId: string;
  historicalPackageRevisionId: string;
  storeIdentity: ExactVisualIdentity;
  storeText: string;
  requestedUrl: string;
  finalUrl: string;
};

export type HistoricalPackageMatchDecision =
  | {
    authorized: true;
    equivalenceId: string;
    displayDisclosure: 'Packaging may vary';
  }
  | {
    authorized: false;
    reason:
      | 'no-approved-official-equivalence'
      | 'candidate-mismatch'
      | 'identity-mismatch'
      | 'cross-size'
      | 'package-revision-mismatch'
      | 'store-host-mismatch'
      | 'store-text-mismatch';
  };

const hashPattern = /^[0-9a-f]{64}$/;
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const approvedOfficialEvidenceContracts = {
  'loccitane-almond-shower-oil-500ml-same-formula-new-look-2026': {
    candidateId: 'loccitane-almond-shower-oil-500ml',
    sourceUrl: 'https://ae.loccitane.com/en/new/almond-shower-essentials',
    sourceHost: 'ae.loccitane.com',
    officialProductId: '29HD500A26',
    officialDisplayName: 'Almond (Amande)',
    officialSizeToken: '500ml',
    officialImageFilename: '29HD500A26C_SQUARE_RVB.png',
    equivalenceStatement: 'Same Formula, New Look',
    responseSha256: '64d032fb14cc2e3287e0c0b5e1c60ca1cd31d70f926e67018024fb4eab40151d',
    recordSha256: '5e3db9ebcca83bd5fb069c0810f4d2647a6b83931b36bde04aa603735cec2b2e',
  },
} as const;

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function objectRecord(value: unknown, label: string): Record<string, unknown> {
  invariant(Boolean(value) && typeof value === 'object' && !Array.isArray(value), `${label} must be an object.`);
  return value as Record<string, unknown>;
}

function normalized(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function cleanText(value: unknown, label: string, min = 1, max = 500) {
  invariant(typeof value === 'string', `${label} must be text.`);
  const result = value.trim().replace(/\s+/g, ' ');
  invariant(result.length >= min && result.length <= max && !/[<>]/.test(result), `${label} is invalid.`);
  return result;
}

function exactIdentity(value: unknown, label: string): ExactVisualIdentity {
  const record = objectRecord(value, label);
  return {
    brand: cleanText(record.brand, `${label} brand`, 2, 120),
    canonicalName: cleanText(record.canonicalName, `${label} canonical name`, 2, 180),
    variant: cleanText(record.variant, `${label} variant`, 2, 180),
    size: cleanText(record.size, `${label} size`, 2, 40),
  };
}

function sameIdentity(left: ExactVisualIdentity, right: ExactVisualIdentity) {
  return normalized(left.brand) === normalized(right.brand)
    && normalized(left.canonicalName) === normalized(right.canonicalName)
    && normalized(left.variant) === normalized(right.variant)
    && normalized(left.size) === normalized(right.size);
}

function identityKey(candidateId: string, identity: ExactVisualIdentity) {
  return [candidateId, identity.brand, identity.canonicalName, identity.variant, identity.size]
    .map(normalized)
    .join('|');
}

function validDate(value: unknown, label: string, nullable = false) {
  if (nullable && value === null) return null;
  invariant(typeof value === 'string' && Number.isFinite(Date.parse(value)), `${label} must be an ISO timestamp.`);
  return value;
}

function positiveInteger(value: unknown, label: string) {
  invariant(Number.isSafeInteger(value) && Number(value) > 0, `${label} must be a positive integer.`);
  return Number(value);
}

function sha256(value: Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function immutableDataPath(value: unknown, label: string, sha: string, prefix: string) {
  const result = cleanText(value, label, 10, 300);
  invariant(!path.isAbsolute(result) && !result.includes('..'), `${label} must be project-relative.`);
  invariant(result.startsWith(prefix), `${label} must stay inside ${prefix}.`);
  invariant(path.basename(result).includes(sha.slice(0, 12)), `${label} must include its content digest.`);
  return result;
}

function visualAsset(value: unknown, label: string) {
  const record = objectRecord(value, label);
  invariant(hashPattern.test(String(record.sha256)), `${label} hash is invalid.`);
  const digest = String(record.sha256);
  const mimeType = record.mimeType;
  invariant(mimeType === 'image/png' || mimeType === 'image/webp', `${label} MIME type is invalid.`);
  const width = positiveInteger(record.width, `${label} width`);
  const height = positiveInteger(record.height, `${label} height`);
  const subjectRegion = record.subjectRegion == null ? null : objectRecord(record.subjectRegion, `${label} subject region`);
  if (subjectRegion) {
    const left = positiveInteger(subjectRegion.left, `${label} subject left`);
    const top = positiveInteger(subjectRegion.top, `${label} subject top`);
    const right = positiveInteger(subjectRegion.right, `${label} subject right`);
    const bottom = positiveInteger(subjectRegion.bottom, `${label} subject bottom`);
    invariant(left < right && top < bottom && right < width && bottom < height, `${label} subject region is invalid.`);
  }
  return {
    sha256: digest,
    mimeType,
    byteSize: positiveInteger(record.byteSize, `${label} byte size`),
    width,
    height,
    immutablePath: immutableDataPath(
      record.immutablePath,
      `${label} immutable path`,
      digest,
      'data/catalogue-package-revision-assets/',
    ),
  };
}

export function verifyCatalogueProductVisualRevisionManifest(
  value: unknown,
): CatalogueProductVisualRevisionManifest {
  const source = objectRecord(value, 'Catalogue product visual revision manifest');
  invariant(source.schemaVersion === catalogueProductVisualRevisionSchemaVersion, 'Unsupported catalogue product visual revision schema.');
  invariant(source.exposure === catalogueProductVisualRevisionExposure, 'Catalogue product visual revisions must remain private authority.');
  invariant(Array.isArray(source.revisions) && source.revisions.length > 0, 'Catalogue product visual revisions are missing.');
  invariant(Array.isArray(source.rejectedCandidateAssets), 'Rejected catalogue visual candidates are missing.');

  const revisions = source.revisions as CatalogueProductVisualRevision[];
  const seenRevisionIds = new Set<string>();
  const revisionsById = new Map<string, CatalogueProductVisualRevision>();
  for (const revision of revisions) {
    invariant(idPattern.test(revision.revisionId), `${revision.revisionId}: visual revision id is invalid.`);
    invariant(!seenRevisionIds.has(revision.revisionId), `${revision.revisionId}: duplicate visual revision.`);
    seenRevisionIds.add(revision.revisionId);
    revisionsById.set(revision.revisionId, revision);
    invariant(idPattern.test(revision.candidateId), `${revision.revisionId}: candidate id is invalid.`);
    exactIdentity(revision.identity, `${revision.revisionId} identity`);
    invariant(revision.package.observedState === 'current-at-capture' || revision.package.observedState === 'historical-at-capture', `${revision.revisionId}: package observed state is invalid.`);
    cleanText(revision.package.description, `${revision.revisionId} package description`, 8, 300);
    validDate(revision.package.capturedAt, `${revision.revisionId} package capture`);
    validDate(revision.package.effectiveAt, `${revision.revisionId} package effective date`, true);
    const asset = visualAsset(revision.asset, `${revision.revisionId} asset`);
    invariant(revision.asset.publishable === false, `${revision.revisionId}: reference evidence cannot become a catalogue packshot.`);
    if (revision.package.observedState === 'current-at-capture') {
      invariant(revision.asset.role === 'official-current-package-reference', `${revision.revisionId}: current revision must remain a private official reference.`);
      invariant(revision.provenance.kind === 'official-brand-media' && revision.review.state === 'approved-reference-only', `${revision.revisionId}: current revision requires official reference review.`);
      invariant(revision.provenance.reuseBasis === 'private-identity-reference-only', `${revision.revisionId}: current reference cannot claim publication rights.`);
      invariant(revision.provenance.sourceUrl != null, `${revision.revisionId}: official source URL is missing.`);
      const sourceUrl = new URL(revision.provenance.sourceUrl);
      invariant(sourceUrl.protocol === 'https:' && sourceUrl.hostname === 'ae.loccitane.com', `${revision.revisionId}: official source host is invalid.`);
      invariant(asset.mimeType === 'image/png', `${revision.revisionId}: current official reference must be PNG.`);
    } else {
      invariant(revision.asset.role === 'packaging-continuity-evidence', `${revision.revisionId}: historical revision must remain private continuity evidence.`);
      invariant(revision.provenance.kind === 'founder-supplied-packaging-continuity-reference', `${revision.revisionId}: historical provenance is invalid.`);
      invariant(revision.provenance.sourceUrl === null && revision.provenance.reuseBasis === 'private-evidence-only', `${revision.revisionId}: historical evidence cannot claim publication rights.`);
      invariant(revision.review.state === 'evidence-only', `${revision.revisionId}: historical founder reference must remain evidence-only.`);
    }
    validDate(revision.provenance.retainedAt, `${revision.revisionId} provenance retention`);
    validDate(revision.review.reviewedAt, `${revision.revisionId} review`);
    cleanText(revision.review.reviewer, `${revision.revisionId} reviewer`, 2, 120);
    cleanText(revision.review.notes, `${revision.revisionId} review notes`, 10, 500);
  }

  for (const revision of revisions) {
    const predecessorId = revision.package.supersedesRevisionId;
    if (!predecessorId) continue;
    const predecessor = revisionsById.get(predecessorId);
    invariant(predecessor, `${revision.revisionId}: predecessor package revision is missing.`);
    invariant(predecessor.candidateId === revision.candidateId && sameIdentity(predecessor.identity, revision.identity), `${revision.revisionId}: linked package revision changes exact identity or size.`);
  }

  const revisionGroups = new Map<string, CatalogueProductVisualRevision[]>();
  for (const revision of revisions) {
    const key = identityKey(revision.candidateId, revision.identity);
    revisionGroups.set(key, [...(revisionGroups.get(key) ?? []), revision]);
  }
  for (const group of revisionGroups.values()) {
    const supersededRevisionIds = new Set(group.flatMap(revision => (
      revision.package.supersedesRevisionId ? [revision.package.supersedesRevisionId] : []
    )));
    const currentHeads = group.filter(revision => !supersededRevisionIds.has(revision.revisionId));
    invariant(currentHeads.length === 1, `${group[0].candidateId}: exact identity must have exactly one derived current package revision.`);
    invariant(currentHeads[0].package.observedState === 'current-at-capture', `${currentHeads[0].revisionId}: derived current revision was not observed as current.`);
    const visited = new Set<string>();
    let cursor: CatalogueProductVisualRevision | undefined = currentHeads[0];
    while (cursor) {
      invariant(!visited.has(cursor.revisionId), `${cursor.revisionId}: package revision chain contains a cycle.`);
      visited.add(cursor.revisionId);
      cursor = cursor.package.supersedesRevisionId
        ? revisionsById.get(cursor.package.supersedesRevisionId)
        : undefined;
    }
    invariant(visited.size === group.length, `${group[0].candidateId}: package revisions must form one append-only chain.`);
  }

  const rejectedCandidateAssets = source.rejectedCandidateAssets as CatalogueRejectedVisualCandidate[];
  const seenCandidateAssets = new Set<string>();
  for (const candidate of rejectedCandidateAssets) {
    invariant(idPattern.test(candidate.candidateAssetId), `${candidate.candidateAssetId}: rejected candidate id is invalid.`);
    invariant(!seenCandidateAssets.has(candidate.candidateAssetId), `${candidate.candidateAssetId}: duplicate rejected candidate asset.`);
    seenCandidateAssets.add(candidate.candidateAssetId);
    invariant(idPattern.test(candidate.candidateId), `${candidate.candidateAssetId}: candidate id is invalid.`);
    exactIdentity(candidate.identity, `${candidate.candidateAssetId} identity`);
    visualAsset(candidate, `${candidate.candidateAssetId} asset`);
    invariant(candidate.provenance.kind === 'founder-supplied-candidate' && candidate.provenance.sourceUrl === null, `${candidate.candidateAssetId}: rejected provenance is invalid.`);
    invariant(candidate.provenance.reuseBasis === 'unknown-not-publishable', `${candidate.candidateAssetId}: rejected candidate cannot claim reuse rights.`);
    invariant(candidate.review.state === 'rejected', `${candidate.candidateAssetId}: suspect candidate must remain rejected.`);
    invariant(candidate.review.reasons.includes('oversized-baked-shadow'), `${candidate.candidateAssetId}: baked shadow rejection is missing.`);
    invariant(candidate.review.reasons.includes('horizontal-stretch-bands'), `${candidate.candidateAssetId}: stretch rejection is missing.`);
    invariant(candidate.review.reasons.includes('alpha-edge-colour-fringe'), `${candidate.candidateAssetId}: edge-fringe rejection is missing.`);
    invariant(candidate.review.reasons.includes('publishable-provenance-unresolved'), `${candidate.candidateAssetId}: provenance rejection is missing.`);
  }

  return {
    schemaVersion: catalogueProductVisualRevisionSchemaVersion,
    exposure: catalogueProductVisualRevisionExposure,
    revisions,
    rejectedCandidateAssets,
  };
}

export function verifyCataloguePackageRevisionEquivalenceManifest(
  value: unknown,
  visualManifest: CatalogueProductVisualRevisionManifest,
): CataloguePackageRevisionEquivalenceManifest {
  const source = objectRecord(value, 'Catalogue package revision equivalence manifest');
  invariant(source.schemaVersion === 1, 'Unsupported catalogue package revision equivalence schema.');
  invariant(source.exposure === catalogueProductVisualRevisionExposure, 'Package revision equivalences must remain private authority.');
  invariant(Array.isArray(source.equivalences), 'Package revision equivalences are missing.');
  const revisionsById = new Map(visualManifest.revisions.map(revision => [revision.revisionId, revision]));
  const equivalences = source.equivalences as CataloguePackageRevisionEquivalence[];
  const seenIds = new Set<string>();
  for (const equivalence of equivalences) {
    invariant(idPattern.test(equivalence.equivalenceId), `${equivalence.equivalenceId}: equivalence id is invalid.`);
    invariant(!seenIds.has(equivalence.equivalenceId), `${equivalence.equivalenceId}: duplicate equivalence.`);
    seenIds.add(equivalence.equivalenceId);
    invariant(idPattern.test(equivalence.candidateId), `${equivalence.equivalenceId}: candidate id is invalid.`);
    const current = revisionsById.get(equivalence.currentPackageRevisionId);
    const historical = revisionsById.get(equivalence.historicalPackageRevisionId);
    invariant(current && historical && current.revisionId !== historical.revisionId, `${equivalence.equivalenceId}: current or historical package revision is invalid.`);
    invariant(!visualManifest.revisions.some(revision => revision.package.supersedesRevisionId === current.revisionId), `${equivalence.equivalenceId}: declared current package is superseded.`);
    let cursor: CatalogueProductVisualRevision | undefined = current;
    const predecessorIds = new Set<string>();
    while (cursor?.package.supersedesRevisionId) {
      predecessorIds.add(cursor.package.supersedesRevisionId);
      cursor = revisionsById.get(cursor.package.supersedesRevisionId);
    }
    invariant(predecessorIds.has(historical.revisionId), `${equivalence.equivalenceId}: declared historical package is not in the current revision chain.`);
    const declaredIdentity = exactIdentity(equivalence, `${equivalence.equivalenceId} identity`);
    invariant(current.candidateId === equivalence.candidateId && historical.candidateId === equivalence.candidateId, `${equivalence.equivalenceId}: candidate id does not bind both revisions.`);
    invariant(sameIdentity(current.identity, declaredIdentity) && sameIdentity(historical.identity, declaredIdentity), `${equivalence.equivalenceId}: equivalence changes exact brand, name, variant or size.`);
    invariant(equivalence.relationship === 'same-formula-new-look', `${equivalence.equivalenceId}: unsupported equivalence relationship.`);
    invariant(equivalence.permittedUse === 'historical-retailer-package-image-match', `${equivalence.equivalenceId}: permitted use is invalid.`);
    invariant(equivalence.publicationAuthority === 'none', `${equivalence.equivalenceId}: equivalence cannot grant publication authority.`);
    invariant(equivalence.displayDisclosure === 'Packaging may vary', `${equivalence.equivalenceId}: disclosure must be truthful and neutral.`);
    invariant(equivalence.reviewState === 'approved', `${equivalence.equivalenceId}: official equivalence is not approved.`);
    validDate(equivalence.reviewedAt, `${equivalence.equivalenceId} review`);
    const evidence = equivalence.officialEvidence;
    const approvedContract = approvedOfficialEvidenceContracts[
      equivalence.equivalenceId as keyof typeof approvedOfficialEvidenceContracts
    ];
    invariant(approvedContract, `${equivalence.equivalenceId}: no code-reviewed official evidence contract exists.`);
    const sourceUrl = new URL(evidence.sourceUrl);
    invariant(sourceUrl.protocol === 'https:' && sourceUrl.hostname === evidence.sourceHost, `${equivalence.equivalenceId}: official evidence host is invalid.`);
    invariant(
      equivalence.candidateId === approvedContract.candidateId
      && evidence.sourceUrl === approvedContract.sourceUrl
      && evidence.sourceHost === approvedContract.sourceHost
      && evidence.responseSha256 === approvedContract.responseSha256
      && evidence.recordSha256 === approvedContract.recordSha256,
      `${equivalence.equivalenceId}: official evidence is not bound to its code-reviewed contract.`,
    );
    validDate(evidence.retrievedAt, `${equivalence.equivalenceId} evidence retrieval`);
    validDate(evidence.effectiveAt, `${equivalence.equivalenceId} evidence effective date`, true);
    invariant(evidence.responseMimeType === 'text/html', `${equivalence.equivalenceId}: official evidence MIME is invalid.`);
    invariant(hashPattern.test(evidence.responseSha256) && hashPattern.test(evidence.recordSha256), `${equivalence.equivalenceId}: official evidence hash is invalid.`);
    positiveInteger(evidence.responseByteSize, `${equivalence.equivalenceId} response byte size`);
    invariant(Number.isSafeInteger(evidence.recordStartByte) && evidence.recordStartByte >= 0, `${equivalence.equivalenceId}: record start is invalid.`);
    invariant(Number.isSafeInteger(evidence.recordEndByte) && evidence.recordEndByte > evidence.recordStartByte && evidence.recordEndByte <= evidence.responseByteSize, `${equivalence.equivalenceId}: record end is invalid.`);
    immutableDataPath(
      evidence.retainedPath,
      `${equivalence.equivalenceId} retained evidence path`,
      evidence.responseSha256,
      'data/catalogue-package-revision-evidence/',
    );
    invariant(
      evidence.officialProductId === approvedContract.officialProductId
      && evidence.officialDisplayName === approvedContract.officialDisplayName
      && evidence.officialImageFilename === approvedContract.officialImageFilename
      && evidence.equivalenceStatement === approvedContract.equivalenceStatement,
      `${equivalence.equivalenceId}: official product evidence fields drifted.`,
    );
    const requiredRecordText = [
      `data-pid="${approvedContract.officialProductId}"`,
      approvedContract.officialDisplayName,
      `item_size&quot;:&quot;${approvedContract.officialSizeToken}&quot;`,
      approvedContract.equivalenceStatement,
      approvedContract.officialImageFilename,
    ];
    invariant(
      Array.isArray(evidence.requiredRecordText)
      && evidence.requiredRecordText.length === requiredRecordText.length
      && new Set(evidence.requiredRecordText).size === requiredRecordText.length
      && requiredRecordText.every((text, index) => evidence.requiredRecordText[index] === text),
      `${equivalence.equivalenceId}: exact official evidence text is not code-bound.`,
    );
  }
  return { schemaVersion: 1, exposure: catalogueProductVisualRevisionExposure, equivalences };
}

async function containedRegularFile(projectRoot: string, immutablePath: string, label: string) {
  const dataRoot = path.resolve(projectRoot, 'data');
  const absolutePath = path.resolve(projectRoot, immutablePath);
  const relativeToData = path.relative(dataRoot, absolutePath);
  invariant(relativeToData.length > 0 && !relativeToData.startsWith('..') && !path.isAbsolute(relativeToData), `${label}: artifact path escaped the data directory.`);
  const dataRootStat = await lstat(dataRoot);
  invariant(dataRootStat.isDirectory() && !dataRootStat.isSymbolicLink(), `${label}: data directory must not be a symlink.`);
  let cursor = dataRoot;
  for (const segment of relativeToData.split(path.sep)) {
    cursor = path.join(cursor, segment);
    const stat = await lstat(cursor);
    invariant(!stat.isSymbolicLink(), `${label}: artifact path contains a symlink.`);
  }
  const resolvedDataRoot = await realpath(dataRoot);
  const resolvedPath = await realpath(absolutePath);
  const relativeResolvedPath = path.relative(resolvedDataRoot, resolvedPath);
  invariant(relativeResolvedPath.length > 0 && !relativeResolvedPath.startsWith('..') && !path.isAbsolute(relativeResolvedPath), `${label}: resolved artifact path escaped data.`);
  const stat = await lstat(absolutePath);
  invariant(stat.isFile() && !stat.isSymbolicLink(), `${label}: artifact must be a regular non-symlink file.`);
  return absolutePath;
}

async function verifyImageArtifact(
  projectRoot: string,
  artifact: { immutablePath: string; sha256: string; byteSize: number; width: number; height: number; mimeType: 'image/png' | 'image/webp' },
  label: string,
) {
  const absolutePath = await containedRegularFile(projectRoot, artifact.immutablePath, label);
  const bytes = await readFile(absolutePath);
  invariant(bytes.length === artifact.byteSize, `${label}: artifact byte size drifted.`);
  invariant(sha256(bytes) === artifact.sha256, `${label}: artifact digest drifted.`);
  const metadata = await sharp(bytes, { animated: false, failOn: 'warning' }).metadata();
  const expectedFormat = artifact.mimeType === 'image/png' ? 'png' : 'webp';
  invariant(metadata.format === expectedFormat, `${label}: decoded format does not match MIME.`);
  invariant(metadata.width === artifact.width && metadata.height === artifact.height, `${label}: decoded dimensions drifted.`);
}

export async function verifyCatalogueProductVisualRevisionArtifacts(
  visualManifest: CatalogueProductVisualRevisionManifest,
  equivalenceManifest: CataloguePackageRevisionEquivalenceManifest,
  projectRoot = process.cwd(),
) {
  for (const revision of visualManifest.revisions) {
    await verifyImageArtifact(projectRoot, revision.asset, revision.revisionId);
  }
  for (const candidate of visualManifest.rejectedCandidateAssets) {
    await verifyImageArtifact(projectRoot, candidate, candidate.candidateAssetId);
  }
  for (const equivalence of equivalenceManifest.equivalences) {
    const evidence = equivalence.officialEvidence;
    const absolutePath = await containedRegularFile(projectRoot, evidence.retainedPath, equivalence.equivalenceId);
    const bytes = await readFile(absolutePath);
    invariant(bytes.length === evidence.responseByteSize, `${equivalence.equivalenceId}: evidence byte size drifted.`);
    invariant(sha256(bytes) === evidence.responseSha256, `${equivalence.equivalenceId}: evidence response digest drifted.`);
    const fragment = bytes.subarray(evidence.recordStartByte, evidence.recordEndByte);
    invariant(sha256(fragment) === evidence.recordSha256, `${equivalence.equivalenceId}: official product record digest drifted.`);
    const recordText = fragment.toString('utf8');
    for (const requiredText of evidence.requiredRecordText) {
      invariant(recordText.includes(requiredText), `${equivalence.equivalenceId}: official product record no longer contains ${requiredText}.`);
    }
  }
}

export function authorizeHistoricalPackageMatch(
  input: HistoricalPackageMatchInput,
  manifest: CataloguePackageRevisionEquivalenceManifest,
): HistoricalPackageMatchDecision {
  const equivalence = manifest.equivalences.find(record => record.candidateId === input.candidateId);
  if (!equivalence || equivalence.reviewState !== 'approved') {
    return { authorized: false, reason: 'no-approved-official-equivalence' };
  }
  if (equivalence.candidateId !== input.candidateId) {
    return { authorized: false, reason: 'candidate-mismatch' };
  }
  if (normalized(equivalence.size) !== normalized(input.size) || normalized(input.storeIdentity.size) !== normalized(input.size)) {
    return { authorized: false, reason: 'cross-size' };
  }
  const requestedIdentity: ExactVisualIdentity = {
    brand: input.brand,
    canonicalName: input.canonicalName,
    variant: input.variant,
    size: input.size,
  };
  const equivalenceIdentity: ExactVisualIdentity = {
    brand: equivalence.brand,
    canonicalName: equivalence.canonicalName,
    variant: equivalence.variant,
    size: equivalence.size,
  };
  if (!sameIdentity(requestedIdentity, equivalenceIdentity) || !sameIdentity(input.storeIdentity, equivalenceIdentity)) {
    return { authorized: false, reason: 'identity-mismatch' };
  }
  if (
    equivalence.currentPackageRevisionId !== input.currentPackageRevisionId
    || equivalence.historicalPackageRevisionId !== input.historicalPackageRevisionId
  ) return { authorized: false, reason: 'package-revision-mismatch' };

  let requestedUrl: URL;
  let finalUrl: URL;
  try {
    requestedUrl = new URL(input.requestedUrl);
    finalUrl = new URL(input.finalUrl);
  } catch {
    return { authorized: false, reason: 'store-host-mismatch' };
  }
  if (
    requestedUrl.protocol !== 'https:'
    || finalUrl.protocol !== 'https:'
    || requestedUrl.origin !== finalUrl.origin
    || requestedUrl.username
    || requestedUrl.password
    || finalUrl.username
    || finalUrl.password
  ) return { authorized: false, reason: 'store-host-mismatch' };

  const storeText = normalized(input.storeText);
  const requiredStoreText = [
    input.storeIdentity.brand,
    input.storeIdentity.canonicalName,
    input.storeIdentity.variant,
    input.storeIdentity.size,
  ].map(normalized);
  const paddedStoreText = ` ${storeText} `;
  if (!requiredStoreText.every(text => text.length > 0 && paddedStoreText.includes(` ${text} `))) {
    return { authorized: false, reason: 'store-text-mismatch' };
  }
  return {
    authorized: true,
    equivalenceId: equivalence.equivalenceId,
    displayDisclosure: equivalence.displayDisclosure,
  };
}

export function packagingDisclosureForExactIdentity(
  identity: { candidateId: string } & ExactVisualIdentity,
  manifest: CataloguePackageRevisionEquivalenceManifest,
) {
  const equivalence = manifest.equivalences.find(record => (
    record.candidateId === identity.candidateId
    && sameIdentity(identity, {
      brand: record.brand,
      canonicalName: record.canonicalName,
      variant: record.variant,
      size: record.size,
    })
    && record.reviewState === 'approved'
  ));
  return equivalence?.displayDisclosure ?? null;
}
