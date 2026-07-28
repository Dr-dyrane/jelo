import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

test('private research capture integrity is checked in CI but cannot gate a production release', async () => {
  const [packageSource, releaseSource, deploymentSource, workflowSource] = await Promise.all([
    readFile(path.join(root, 'package.json'), 'utf8'),
    readFile(path.join(root, 'scripts/verify-release.ts'), 'utf8'),
    readFile(path.join(root, 'scripts/vercel-build.ts'), 'utf8'),
    readFile(path.join(root, '.github/workflows/validate.yml'), 'utf8'),
  ]);
  const packageJson = JSON.parse(packageSource) as {
    scripts?: Record<string, string>;
  };
  const researchIntegrityCommand = packageJson.scripts?.['verify:research-integrity'];

  assert.match(researchIntegrityCommand ?? '', /catalogue:research:verify/);
  assert.match(researchIntegrityCommand ?? '', /catalogue:research:packets:verify/);
  assert.match(researchIntegrityCommand ?? '', /catalogue:research:offers:verify/);

  assert.doesNotMatch(releaseSource, /catalogue:research:packets:verify/);
  assert.doesNotMatch(releaseSource, /catalogue:research:offers:verify/);
  assert.doesNotMatch(deploymentSource, /verify:research-integrity/);

  assert.match(workflowSource, /Verify private research integrity/);
  assert.match(workflowSource, /npm run verify:research-integrity/);
});
