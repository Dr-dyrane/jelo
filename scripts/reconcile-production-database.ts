import { spawn } from 'node:child_process';
import { requireAdminDatabaseUrl } from './lib/admin-database';

const INCLUDE_EXTERNAL_DISCOVERY = '--include-external-discovery';

function runPackageScript(script: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn('npm', ['run', script], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: process.env,
    });
    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`Database reconciliation step ${script} failed.`));
    });
  });
}

async function main() {
  requireAdminDatabaseUrl();
  const options = process.argv.slice(2);
  const unknown = options.filter(option => option !== INCLUDE_EXTERNAL_DISCOVERY);
  if (unknown.length) {
    throw new Error(`Only ${INCLUDE_EXTERNAL_DISCOVERY} is supported.`);
  }

  const steps = [
    'db:migrate',
    'db:seed',
    ...(options.includes(INCLUDE_EXTERNAL_DISCOVERY) ? ['db:seed:external'] : []),
    'assets:product:seed',
    'assets:editorial:seed',
  ];

  for (const step of steps) await runPackageScript(step);
  console.log(`Database reconciliation completed (${steps.length} reviewed steps).`);
}

main().catch(() => {
  console.error('Database reconciliation failed.');
  process.exitCode = 1;
});
