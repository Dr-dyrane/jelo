import { createHash } from 'node:crypto';
import type { RetailerReference } from '@/data/retailers';
import type { RetailerIdentityEvidence } from '@/data/retail-evidence';

export type ReviewedBrandSellerEvidence = Extract<RetailerIdentityEvidence, { basis: 'brand-source' }>;

const hashPattern = /^[0-9a-f]{64}$/;
const brandSellerEvidenceMaxAgeMs = 180 * 86_400_000;

function normalized(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function normalizedHost(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return undefined;
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return undefined;
  }
}

export function brandSellerEvidenceExcerptSha256(sourceText: string) {
  return createHash('sha256')
    .update(`jelocare-brand-seller-evidence-v1\n${sourceText}\n`)
    .digest('hex');
}

export function reviewedBrandSellerEvidenceValid(
  retailer: RetailerReference,
  evidenceUrl: string | undefined,
  asOf: number,
) {
  const evidence = retailer.identityEvidence;
  if (
    !evidence
    || evidence.basis !== 'brand-source'
    || evidence.scope !== 'independent'
    || !evidenceUrl
    || typeof evidence.sourceUrl !== 'string'
    || typeof evidence.subjectSeller !== 'string'
    || typeof evidence.subjectHost !== 'string'
    || typeof evidence.responseUrl !== 'string'
    || normalizedHost(evidence.sourceUrl) === undefined
    || normalizedHost(evidenceUrl) === undefined
    || new URL(evidence.sourceUrl).href !== new URL(evidenceUrl).href
    || normalized(evidence.subjectSeller) !== normalized(retailer.name)
    || normalizedHost(`https://${evidence.subjectHost}`) !== normalizedHost(retailer.homepage)
    || typeof evidence.locator !== 'string'
    || evidence.locator.trim().length < 8
    || typeof evidence.sourceText !== 'string'
    || evidence.sourceText.trim().length < 8
    || !evidence.sourceText.toLowerCase().includes(evidence.subjectHost.toLowerCase())
    || !normalized(evidence.sourceText).includes(normalized(evidence.subjectSeller))
    || !hashPattern.test(evidence.sourceExcerptSha256)
    || brandSellerEvidenceExcerptSha256(evidence.sourceText) !== evidence.sourceExcerptSha256
    || normalizedHost(evidence.responseUrl) === undefined
    || new URL(evidence.responseUrl).href !== new URL(evidence.sourceUrl).href
    || !hashPattern.test(evidence.responseSha256)
    || evidence.responseDigestScope !== 'decoded-response-body'
    || !['application/json', 'text/html'].includes(evidence.responseMimeType)
    || !Number.isSafeInteger(evidence.responseByteSize)
    || evidence.responseByteSize <= 0
    || typeof evidence.reviewer !== 'string'
    || evidence.reviewer.trim().length < 2
  ) return false;

  const observedAt = Date.parse(evidence.observedAt);
  const retrievedAt = Date.parse(evidence.retrievedAt);
  const reviewedAt = Date.parse(evidence.reviewedAt);
  return Number.isFinite(observedAt)
    && Number.isFinite(retrievedAt)
    && Number.isFinite(reviewedAt)
    && observedAt === retrievedAt
    && reviewedAt >= retrievedAt
    && reviewedAt <= asOf + 5 * 60_000
    && observedAt <= asOf + 5 * 60_000
    && observedAt >= asOf - brandSellerEvidenceMaxAgeMs;
}

export function reviewedBrandSellerEvidenceFor(
  retailer: RetailerReference,
  evidenceUrl: string | undefined,
  asOf: number,
): ReviewedBrandSellerEvidence | undefined {
  if (!reviewedBrandSellerEvidenceValid(retailer, evidenceUrl, asOf)) return undefined;
  return retailer.identityEvidence as ReviewedBrandSellerEvidence;
}
