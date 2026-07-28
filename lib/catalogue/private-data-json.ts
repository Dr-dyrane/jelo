import { randomUUID } from 'node:crypto';
import {
  lstat,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

function missingFile(error: unknown) {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && error.code === 'ENOENT',
  );
}

export async function resolveDirectDataJson(
  repositoryRoot: string,
  value: string,
  label: string,
) {
  const dataRoot = path.resolve(repositoryRoot, 'data');
  const filename = path.resolve(repositoryRoot, value);
  if (path.dirname(filename) !== dataRoot || !filename.endsWith('.json')) {
    throw new Error(`${label} must be a direct JSON file inside data/.`);
  }

  try {
    const metadata = await lstat(filename);
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      throw new Error(`${label} must be a regular, non-symlinked JSON file inside data/.`);
    }
  } catch (error) {
    if (!missingFile(error)) throw error;
  }

  return filename;
}

export async function writeDirectDataJsonAtomically(
  filename: string,
  contents: string,
) {
  const temporary = path.join(
    path.dirname(filename),
    `.${path.basename(filename)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporary, contents, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, filename);
  } finally {
    await rm(temporary, { force: true });
  }
}
