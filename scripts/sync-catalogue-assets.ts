import { spawn } from 'node:child_process';

function run(command: string, args: string[], tolerateFailure = false) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('error', reject);
    child.on('exit', code => {
      const exitCode = code ?? 1;
      if (exitCode !== 0 && !tolerateFailure) {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${exitCode}.`));
        return;
      }
      resolve(exitCode);
    });
  });
}

async function main() {
console.log('\nJeloCare catalogue asset inventory — before sync\n');
await run('npm', ['run', 'assets:audit']);

console.log('\nImporting every pending Neon image into Vercel Blob\n');
const importExitCode = await run('npm', ['run', 'assets:import'], true);

console.log('\nJeloCare catalogue asset inventory — after sync\n');
await run('npm', ['run', 'assets:audit']);

if (importExitCode !== 0) {
  console.error('\nAsset sync completed with one or more failed source URLs. Review data/asset-import-results.json.');
  process.exitCode = importExitCode;
} else {
  console.log('\nAsset sync complete. All importable catalogue images are recorded in Blob and Neon.');
}
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
