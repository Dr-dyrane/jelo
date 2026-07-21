import { spawn } from 'node:child_process';

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

const isVercelProduction = process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production';
const migrationsDisabled = process.env.SKIP_DATABASE_MIGRATIONS === '1';

if (isVercelProduction && !migrationsDisabled) {
  console.log('Production deployment detected. Applying pending database migrations.');
  await run('npm', ['run', 'db:migrate']);
} else {
  const reason = migrationsDisabled
    ? 'SKIP_DATABASE_MIGRATIONS=1'
    : 'not a Vercel production deployment';
  console.log(`Skipping database migrations: ${reason}.`);
}

await run('next', ['build']);
