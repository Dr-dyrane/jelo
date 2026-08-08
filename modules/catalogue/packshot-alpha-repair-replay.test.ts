import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import alphaRepairManifest from '@/data/catalogue-packshot-alpha-repair-evidence/manifest.json';
import {
  cataloguePackshotAlphaRepairEvidenceManifestPath,
  cataloguePackshotAlphaRepairEvidenceManifestSha256,
  cataloguePackshotAlphaRepairPipelineVersion,
  cataloguePackshotAlphaRepairReplayScriptPath,
} from '@/lib/catalogue/packshot-isolation-record';

function sha256(payload: Buffer) {
  return createHash('sha256').update(payload).digest('hex');
}

test('the repair manifest binds every retained input and reviewed artifact', () => {
  const manifestPath = path.join(process.cwd(), cataloguePackshotAlphaRepairEvidenceManifestPath);
  assert.equal(sha256(readFileSync(manifestPath)), cataloguePackshotAlphaRepairEvidenceManifestSha256);
  assert.equal(alphaRepairManifest.pipelineVersion, cataloguePackshotAlphaRepairPipelineVersion);
  assert.equal(alphaRepairManifest.replay.scriptPath, cataloguePackshotAlphaRepairReplayScriptPath);

  const artifacts: Array<{ path: string; sha256: string; byteSize: number }> = [];
  for (const record of alphaRepairManifest.records) {
    artifacts.push(record.source, record.precursor, record.output);
    artifacts.push({
      path: record.review.surfaceReviewPath,
      sha256: record.review.surfaceReviewSha256,
      byteSize: record.review.surfaceReviewByteSize,
    });
    if (record.geometryReference) artifacts.push(record.geometryReference);
  }
  for (const artifact of artifacts) {
    const payload = readFileSync(path.join(process.cwd(), artifact.path));
    assert.equal(payload.byteLength, artifact.byteSize, artifact.path);
    assert.equal(sha256(payload), artifact.sha256, artifact.path);
  }

  const replayScript = readFileSync(
    path.join(process.cwd(), alphaRepairManifest.replay.scriptPath),
  );
  assert.equal(sha256(replayScript), alphaRepairManifest.replay.scriptSha256);
  assert.equal(
    sha256(readFileSync(path.join(process.cwd(), alphaRepairManifest.replay.prepareScriptPath))),
    alphaRepairManifest.replay.prepareScriptSha256,
  );
  assert.equal(
    sha256(readFileSync(path.join(process.cwd(), alphaRepairManifest.replay.runtimeLockPath))),
    alphaRepairManifest.replay.runtimeLockSha256,
  );
});

const configuredReplayPython = process.env.CATALOGUE_PACKSHOT_PYTHON;
const replayPython = configuredReplayPython
  ?? path.join(process.cwd(), '.cache/reviewed-packshot-venv/bin/python');
const replayRuntimeUnavailable = !configuredReplayPython && !existsSync(replayPython);

test('the deterministic replay reproduces both reviewed PNG byte hashes', {
  timeout: 30_000,
  skip: replayRuntimeUnavailable
    ? 'locked optional packshot replay runtime is not installed in this environment'
    : false,
}, () => {
  assert.equal(
    existsSync(replayPython),
    true,
    'create the locked reviewed-packshot venv or set CATALOGUE_PACKSHOT_PYTHON',
  );
  const replay = spawnSync(
    replayPython,
    [path.join(process.cwd(), cataloguePackshotAlphaRepairReplayScriptPath), '--json'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    },
  );
  assert.equal(replay.status, 0, replay.stderr || replay.stdout);
  const report = JSON.parse(replay.stdout) as {
    pipelineVersion: string;
    replayScriptSha256: string;
    colorProfileSha256: string;
    results: Array<{ candidateId: string; outputSha256: string; outputByteSize: number }>;
  };
  assert.equal(report.pipelineVersion, cataloguePackshotAlphaRepairPipelineVersion);
  assert.equal(report.replayScriptSha256, alphaRepairManifest.replay.scriptSha256);
  assert.equal(report.colorProfileSha256, alphaRepairManifest.replay.colorProfile.sha256);
  assert.deepEqual(
    report.results.map(result => ({
      candidateId: result.candidateId,
      outputSha256: result.outputSha256,
      outputByteSize: result.outputByteSize,
    })),
    alphaRepairManifest.records.map(record => ({
      candidateId: record.candidateId,
      outputSha256: record.output.sha256,
      outputByteSize: record.output.byteSize,
    })),
  );
});
