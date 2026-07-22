import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  catalogueIdentityExtractionCanonicalJson,
  type CatalogueIntakeCandidate,
} from './intake-readiness';

export async function verifyCatalogueIdentityEvidenceArtifacts(
  candidates: readonly CatalogueIntakeCandidate[],
  repositoryRoot = process.cwd(),
) {
  // This verifies the checked-in canonical artifact binding only. The raw HTTP
  // response is represented by digest metadata and is not retained here.
  const evidenceRoot = path.resolve(repositoryRoot, 'data/catalogue-identity-evidence');
  let verified = 0;

  for (const candidate of candidates) {
    const evidence = candidate.identity.officialEvidence;
    if (!evidence) continue;
    const expectedRelativePath = `data/catalogue-identity-evidence/${candidate.id}.json`;
    if (evidence.snapshotPath !== expectedRelativePath) {
      throw new Error(`${candidate.id} identity evidence path is not canonical.`);
    }
    const absolutePath = path.resolve(repositoryRoot, evidence.snapshotPath);
    if (path.dirname(absolutePath) !== evidenceRoot) {
      throw new Error(`${candidate.id} identity evidence escapes the checked-in evidence directory.`);
    }
    const bytes = await readFile(absolutePath);
    const canonical = catalogueIdentityExtractionCanonicalJson(evidence.canonicalExtraction);
    if (!bytes.equals(Buffer.from(canonical, 'utf8'))) {
      throw new Error(`${candidate.id} identity evidence bytes do not match its canonical extraction.`);
    }
    if (bytes.byteLength !== evidence.snapshotByteSize) {
      throw new Error(`${candidate.id} identity evidence byte size changed.`);
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (sha256 !== evidence.snapshotSha256) {
      throw new Error(`${candidate.id} identity evidence hash changed.`);
    }
    verified += 1;
  }

  return verified;
}
