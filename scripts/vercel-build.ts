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
  const plan = createDeploymentPlan({
    isVercelProduction,
  });

  if (!isVercelProduction) {
    console.log('Skipping production release verification and staged asset promotion: not a Vercel production deployment.');
  } else {
    console.log('Production deployment detected. Staged asset promotion must complete before verification and Next build.');
    console.log('Database migrations and reconciliation are operator-only and never run in a Vercel build.');
  }

  const commands: Record<DeploymentStep, [string, string[]]> = {
    'verify-release': ['npm', ['run', 'verify:release']],
    'build-next': ['next', ['build']],
    'promote-staged-assets': ['npm', ['run', 'assets:promote:staged']],
  };

  for (const step of plan) {
    const [command, args] = commands[step];
    await run(command, args);
    if (step === 'build-next') {
      await run('npm', ['run', 'catalogue:search:bundle:verify']);
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
