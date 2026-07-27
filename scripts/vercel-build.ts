import { spawn } from 'node:child_process';
import { createDeploymentPlan, type DeploymentStep } from '../lib/release/deployment-plan';

function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: process.env,
    });

    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`));
    });
  });
}

async function main() {
  const isVercelProduction = process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production';
  const migrationsDisabled = process.env.SKIP_DATABASE_MIGRATIONS === '1';
  // Reviewed catalogue projection is always seeded by a production release.
  // External discovery is a separate, exceptional pathway and must never be
  // enabled by the legacy internal-catalogue flag.
  const seedExternalCatalogue = process.env.SEED_EXTERNAL_CATALOGUE_ON_BUILD === '1';
  const plan = createDeploymentPlan({
    isVercelProduction,
    migrationsDisabled,
    seedExternalCatalogue,
  });

  if (!isVercelProduction) {
    console.log('Skipping production release verification and database mutations: not a Vercel production deployment.');
  } else if (migrationsDisabled) {
    console.log('Production release verification remains enabled; database mutations are disabled by SKIP_DATABASE_MIGRATIONS=1.');
  } else {
    console.log('Production deployment detected. Verification and Next build must pass before external mutations.');
  }
  if (process.env.SEED_CATALOGUE_ON_BUILD === '1') {
    console.log('SEED_CATALOGUE_ON_BUILD is legacy; reviewed catalogue sync already runs in every production release.');
  }

  const commands: Record<DeploymentStep, [string, string[]]> = {
    'verify-release': ['npm', ['run', 'verify:release']],
    'build-next': ['next', ['build']],
    'promote-staged-assets': ['npm', ['run', 'assets:promote:staged']],
    'migrate-database': ['npm', ['run', 'db:migrate']],
    'seed-catalogue': ['npm', ['run', 'db:seed']],
    'seed-external-catalogue': ['npm', ['run', 'db:seed:external']],
    'seed-product-assets': ['npm', ['run', 'assets:product:seed']],
    'seed-editorial-assets': ['npm', ['run', 'assets:editorial:seed']],
  };

  for (const step of plan) {
    if (step === 'seed-catalogue') {
      console.log('Synchronizing the reviewed public catalogue projection.');
    }
    if (step === 'seed-external-catalogue') {
      console.log('One-time external catalogue seed requested for this production build.');
    }
    const [command, args] = commands[step];
    await run(command, args);
    if (step === 'build-next') {
      await run('npm', ['run', 'catalogue:search:bundle:verify']);
    }
  }

  if (isVercelProduction && migrationsDisabled) {
    console.log('Skipping database mutations: SKIP_DATABASE_MIGRATIONS=1.');
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
