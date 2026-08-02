const candidateIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Keep at least one stable, deliberately private catalogue-research canary here.
// Explicit releases are filtered below so promoting a canary cannot break the bundle.
const privateCatalogueCanaries = [
  'a7562a6f718c64e4a046f3e3',
] as const;

const structuralPrivateMarkers = [
  'catalogue-publication-dossiers',
  'catalogue-intake-candidates',
] as const;

type PublicationReleaseManifest = {
  exposure: 'public-catalogue';
  releases: Array<{
    candidateId: string;
    exposure: 'public-catalogue';
    publicationStatus: 'published';
  }>;
};

function publicationReleaseManifest(value: unknown): PublicationReleaseManifest {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || !('exposure' in value)
    || value.exposure !== 'public-catalogue'
    || !('releases' in value)
    || !Array.isArray(value.releases)
  ) {
    throw new Error('The catalogue publication release manifest is malformed.');
  }

  for (const release of value.releases) {
    if (
      !release
      || typeof release !== 'object'
      || Array.isArray(release)
      || !('candidateId' in release)
      || typeof release.candidateId !== 'string'
      || !candidateIdPattern.test(release.candidateId)
      || !('exposure' in release)
      || release.exposure !== 'public-catalogue'
      || !('publicationStatus' in release)
      || release.publicationStatus !== 'published'
    ) {
      throw new Error('The catalogue publication release manifest is malformed.');
    }
  }

  return value as PublicationReleaseManifest;
}

export function privateCatalogueSearchBundleMarkers(
  releaseManifest: unknown,
): string[] {
  const manifest = publicationReleaseManifest(releaseManifest);
  const releasedCandidateIds = new Set(
    manifest.releases.map(release => release.candidateId),
  );

  return [
    ...privateCatalogueCanaries
      .filter(candidateId => !releasedCandidateIds.has(candidateId))
      .sort(),
    ...structuralPrivateMarkers,
  ];
}
