import type {
  HistoricalPackageMatchDecision,
  HistoricalPackageMatchInput,
} from '@/lib/catalogue/product-visual-revision';

export type CatalogueOfferBatchProduct = {
  candidateId: string;
  releaseFingerprint: string | null;
  publicRoute: string | null;
  canonicalIdentity: {
    kind: 'gtin';
    value: string;
    brand: string;
    name: string;
    variant: string;
    size: string;
    packageVersion: string;
  };
};

export type CatalogueOfferBatchObservation = {
  observationId: string;
  retailer: {
    displayName: string;
    legalName: string | null;
    directoryStatus: 'directory-listed' | 'not-listed';
    expectedHost: string;
  };
  requestedUrl: string;
  finalUrl: string;
  canonicalUrl: string | null;
  observedAt: string;
  expiresAt: string;
  observedTitle: string;
  storeIdentityText: string;
  observedBrand: string;
  observedName: string;
  observedVariant: string;
  observedSize: string | null;
  observedPackageVersion: string | null;
  packageMatch: 'current-exact' | 'official-revision-equivalent' | 'mismatch' | 'unverified';
  packagingRevisionAliasId: string | null;
  packageRevisionIds?: {
    current: string;
    historical: string;
  } | null;
  price: {
    amount: number;
    currency: 'NGN';
    sourceText: string;
  };
  stock: {
    status: 'in-stock' | 'low-stock' | 'out-of-stock' | 'unknown';
    sourceText: string | null;
  };
  capture: {
    surface: string;
    documentReadyState: string;
    pageTitle: string;
    digestScope: string;
    sha256: string;
    byteSize: number;
  };
  status: 'admitted' | 'rejected' | 'pending';
  reasons: string[];
};

export type PackageRevisionEquivalenceMatcher = (
  input: HistoricalPackageMatchInput,
) => HistoricalPackageMatchDecision;

export type ExactReleaseAuthority = {
  candidateId: string;
  releaseFingerprint: string;
  publicRoute: string;
  publicationStatus: 'published';
  publicationScope: 'neutral-reference';
  canonicalIdentity: CatalogueOfferBatchProduct['canonicalIdentity'];
};

export type RetailerDirectoryAuthority = {
  displayName: string;
  origin: string;
  reviewStatus: 'directory-listed' | 'provisional';
};

export type CatalogueOfferAdmissionAuthorities = {
  release: ExactReleaseAuthority | null;
  retailer: RetailerDirectoryAuthority | null;
  packageRevisionEquivalent?: PackageRevisionEquivalenceMatcher;
};

const maximumAgeMs = 7 * 24 * 60 * 60 * 1000;

function normalizedIdentity(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[™®]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function packageVersionMatchesIdentity(packageVersion: string, identity: { brand: string; name: string; variant: string; size: string }) {
  const pkgTokens = new Set(normalizedIdentity(packageVersion).split(' ').filter(Boolean));
  const identityText = normalizedIdentity(`${identity.name} ${identity.variant} ${identity.size}`);
  const identityTokens = identityText.split(' ').filter(Boolean);
  const matched = identityTokens.filter(token => pkgTokens.has(token));
  // The package version must contain the size and at least 30% of identity tokens,
  // or match the variant substring directly.
  const hasSize = millilitreSize(identity.size) != null
    && millilitreSize(packageVersion) === millilitreSize(identity.size);
  return hasSize && matched.length >= Math.ceil(identityTokens.length * 0.3);
}

function sameIdentity(left: string, right: string) {
  return normalizedIdentity(left) === normalizedIdentity(right);
}

function identityTokens(value: string) {
  return normalizedIdentity(value)
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .split(' ')
    .filter(Boolean);
}

function containsTokenSequence(haystack: string[], needle: string[]) {
  if (!needle.length || needle.length > haystack.length) return false;
  return haystack.some((_, start) => needle.every((token, offset) => haystack[start + offset] === token));
}

function exactStoreIdentityText(product: CatalogueOfferBatchProduct, offer: CatalogueOfferBatchObservation) {
  if (!offer.observedSize) return false;
  const text = identityTokens(offer.storeIdentityText);
  const required = [
    offer.observedBrand,
    offer.observedName,
    offer.observedVariant,
    offer.observedSize,
  ].map(identityTokens);
  if (!required.every(tokens => containsTokenSequence(text, tokens))) return false;
  const permitted = new Set([
    ...identityTokens(product.canonicalIdentity.brand),
    ...identityTokens(product.canonicalIdentity.name),
    ...identityTokens(product.canonicalIdentity.variant),
    ...identityTokens(product.canonicalIdentity.size),
    ...identityTokens(offer.observedSize),
    'new',
    'packaging',
  ]);
  return text.every(token => permitted.has(token));
}

function millilitreSize(value: string | null) {
  if (!value) return undefined;
  const match = value.match(/(?:^|[^\d])(\d+(?:\.\d+)?)\s*m(?:illi)?l(?:itre|iter)?s?\b/i);
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function sameExactSize(canonical: string, observed: string | null) {
  const canonicalMl = millilitreSize(canonical);
  const observedMl = millilitreSize(observed);
  if (canonicalMl != null || observedMl != null) return canonicalMl === observedMl;
  return Boolean(observed && normalizedIdentity(canonical) === normalizedIdentity(observed));
}

function exactSecureOrigin(value: string | null, expectedOrigin: string) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    const expected = new URL(expectedOrigin);
    return parsed.protocol === 'https:'
      && expected.protocol === 'https:'
      && !parsed.username
      && !parsed.password
      && !parsed.port
      && !expected.username
      && !expected.password
      && !expected.port
      && parsed.origin === expected.origin;
  } catch {
    return false;
  }
}

function exactReleaseIdentity(
  product: CatalogueOfferBatchProduct,
  authority: ExactReleaseAuthority | null,
) {
  if (!authority) return false;
  const expected = authority.canonicalIdentity;
  const actual = product.canonicalIdentity;
  return authority.candidateId === product.candidateId
    && authority.publicationStatus === 'published'
    && authority.publicationScope === 'neutral-reference'
    && product.releaseFingerprint === authority.releaseFingerprint
    && product.publicRoute === authority.publicRoute
    && actual.kind === expected.kind
    && actual.value === expected.value
    && sameIdentity(actual.brand, expected.brand)
    && sameIdentity(actual.name, expected.name)
    && sameIdentity(actual.variant, expected.variant)
    && sameIdentity(actual.size, expected.size)
    && sameIdentity(actual.packageVersion, expected.packageVersion);
}

function priceFromSourceText(value: string) {
  const match = value.trim().match(/^(?:₦|NGN)\s*([0-9]+(?:,[0-9]{3})*)(?:\.([0-9]{2}))?$/i);
  if (!match || (match[2] && match[2] !== '00')) return undefined;
  const parsed = Number(match[1].replaceAll(',', ''));
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function stockFromSourceText(value: string | null) {
  if (!value) return undefined;
  const normalized = normalizedIdentity(value);
  if (/\b(?:out of stock|not in stock|no stock)\b/.test(normalized)) return 'out-of-stock' as const;
  const remaining = normalized.match(/\b(?:only )?(\d+) left(?: in stock)?\b/);
  if (remaining) {
    return Number(remaining[1]) > 0 ? 'low-stock' as const : 'out-of-stock' as const;
  }
  if (/\blow stock\b/.test(normalized)) {
    return 'low-stock' as const;
  }
  if (/\bin stock\b/.test(normalized)) return 'in-stock' as const;
  return undefined;
}

export function catalogueOfferAdmissionBlockers(
  product: CatalogueOfferBatchProduct,
  offer: CatalogueOfferBatchObservation,
  asOf: Date,
  authorities: CatalogueOfferAdmissionAuthorities,
) {
  const blockers: string[] = [];
  const observedAt = Date.parse(offer.observedAt);
  const expiresAt = Date.parse(offer.expiresAt);
  const asOfMs = asOf.getTime();

  if (!product.candidateId.trim() || product.canonicalIdentity.kind !== 'gtin' || !/^\d{8,14}$/.test(product.canonicalIdentity.value)) {
    blockers.push('canonical-product-identity-invalid');
  }
  if (!exactReleaseIdentity(product, authorities.release)) blockers.push('exact-public-release-mismatch');
  if (!offer.observationId.trim()) blockers.push('observation-id-missing');
  if (!offer.retailer.displayName.trim()) blockers.push('retailer-display-name-missing');
  const retailerAuthority = authorities.retailer;
  if (
    !retailerAuthority
    || retailerAuthority.reviewStatus !== 'directory-listed'
    || retailerAuthority.displayName !== offer.retailer.displayName
    || offer.retailer.directoryStatus !== retailerAuthority.reviewStatus
  ) blockers.push('retailer-not-directory-listed');
  const retailerOrigin = retailerAuthority?.origin ?? '';
  try {
    if (offer.retailer.expectedHost !== new URL(retailerOrigin).hostname) blockers.push('retailer-directory-host-mismatch');
  } catch {
    blockers.push('retailer-directory-host-mismatch');
  }

  for (const [label, url] of [
    ['requested', offer.requestedUrl],
    ['final', offer.finalUrl],
    ['canonical', offer.canonicalUrl],
  ] as const) {
    if (!exactSecureOrigin(url, retailerOrigin)) blockers.push(`${label}-retailer-host-mismatch`);
  }

  if (!Number.isFinite(asOfMs)) blockers.push('audit-clock-invalid');
  if (!Number.isFinite(observedAt) || observedAt > asOfMs) blockers.push('observation-time-invalid');
  if (!Number.isFinite(expiresAt) || expiresAt <= asOfMs) blockers.push('offer-expired');
  if (Number.isFinite(observedAt) && Number.isFinite(asOfMs) && asOfMs - observedAt > maximumAgeMs) blockers.push('offer-stale');
  if (Number.isFinite(observedAt) && Number.isFinite(expiresAt) && (
    expiresAt <= observedAt || expiresAt - observedAt > maximumAgeMs
  )) blockers.push('offer-expiry-window-invalid');

  if (offer.capture.surface !== 'Codex in-app browser') blockers.push('capture-surface-ineligible');
  if (!['complete', 'interactive'].includes(offer.capture.documentReadyState)) blockers.push('capture-document-not-ready');
  if (offer.capture.digestScope !== 'rendered-accessibility-tree') blockers.push('capture-digest-scope-ineligible');
  if (!/^[a-f0-9]{64}$/.test(offer.capture.sha256) || offer.capture.byteSize < 1_000) blockers.push('capture-representation-invalid');
  if (!offer.capture.pageTitle.trim() || offer.capture.pageTitle === 'Just a moment...') blockers.push('retailer-challenge-capture');

  if (!sameIdentity(offer.observedBrand, product.canonicalIdentity.brand)) blockers.push('exact-brand-mismatch');
  if (!sameIdentity(offer.observedName, product.canonicalIdentity.name)) blockers.push('exact-name-mismatch');
  if (!sameIdentity(offer.observedVariant, product.canonicalIdentity.variant)) blockers.push('exact-variant-mismatch');
  if (!exactStoreIdentityText(product, offer)) {
    blockers.push('store-identity-text-incomplete');
  }
  if (!sameExactSize(product.canonicalIdentity.size, offer.observedSize)) blockers.push('exact-size-mismatch');

  if (offer.packageMatch === 'current-exact') {
    if (!offer.observedPackageVersion || !packageVersionMatchesIdentity(offer.observedPackageVersion, { brand: product.canonicalIdentity.brand, name: product.canonicalIdentity.name, variant: product.canonicalIdentity.variant, size: product.canonicalIdentity.size })) {
      blockers.push('current-package-version-unverified');
    }

  } else if (offer.packageMatch === 'official-revision-equivalent') {
    const aliasId = offer.packagingRevisionAliasId;
    const revisionIds = offer.packageRevisionIds;
    const decision = aliasId && revisionIds && authorities.packageRevisionEquivalent
      ? authorities.packageRevisionEquivalent({
        candidateId: product.candidateId,
        brand: product.canonicalIdentity.brand,
        canonicalName: product.canonicalIdentity.name,
        variant: product.canonicalIdentity.variant,
        size: product.canonicalIdentity.size,
        currentPackageRevisionId: revisionIds.current,
        historicalPackageRevisionId: revisionIds.historical,
        storeIdentity: {
          brand: product.canonicalIdentity.brand,
          canonicalName: product.canonicalIdentity.name,
          variant: product.canonicalIdentity.variant,
          size: offer.observedSize ?? '',
        },
        storeText: offer.storeIdentityText,
        requestedUrl: offer.requestedUrl,
        finalUrl: offer.finalUrl,
      })
      : null;
    if (!decision?.authorized || decision.equivalenceId !== aliasId) {
      blockers.push('official-package-revision-equivalence-missing');
    }
  } else {
    blockers.push('exact-package-mismatch');
  }

  if (
    !Number.isInteger(offer.price.amount)
    || offer.price.amount <= 0
    || offer.price.currency !== 'NGN'
    || priceFromSourceText(offer.price.sourceText) !== offer.price.amount
  ) {
    blockers.push('ngn-price-evidence-invalid');
  }
  if (
    !['in-stock', 'low-stock', 'out-of-stock'].includes(offer.stock.status)
    || stockFromSourceText(offer.stock.sourceText) !== offer.stock.status
  ) {
    blockers.push('offer-unavailable');
  }

  return [...new Set(blockers)];
}
