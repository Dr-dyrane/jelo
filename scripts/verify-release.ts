import { spawn } from 'node:child_process';

type ReleaseGate = {
  label: string;
  script: string;
};

const releaseGates: ReleaseGate[] = [
  { label: 'Lint', script: 'lint' },
  { label: 'Typecheck', script: 'typecheck' },
  { label: 'Node tests', script: 'test' },
  { label: 'Documentation', script: 'docs:check' },
  { label: 'Per-SKU catalogue intake projection', script: 'catalogue:intake:verify' },
  { label: 'Public catalogue search projection', script: 'catalogue:search:verify' },
  { label: 'Private publication dossiers', script: 'catalogue:publication:verify' },
  { label: 'Explicit catalogue releases', script: 'catalogue:publication:releases:verify' },
  { label: 'Private catalogue research priorities', script: 'catalogue:research:verify' },
  { label: 'Private publication image bytes', script: 'catalogue:publication:images:verify' },
  { label: 'Canonical media', script: 'assets:verify' },
];

function runNpmScript(script: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn('npm', ['run', script], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        ...(script === 'test' ? { NODE_ENV: 'test' } : {}),
      },
    });

    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`npm run ${script} exited with code ${code ?? 'unknown'}`));
    });
  });
}

async function main() {
  for (const gate of releaseGates) {
    console.log(`\nRelease gate: ${gate.label}`);
    await runNpmScript(gate.script);
  }
  console.log('\nRelease verification passed.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
