export interface MigrationTransaction {
  unsafe(source: string): Promise<unknown>;
  record(filename: string): Promise<unknown>;
}

export interface MigrationTransactionRunner {
  begin(work: (transaction: MigrationTransaction) => Promise<void>): Promise<void>;
}

const transactionControlLine = /^\s*(?:begin|start\s+transaction|commit|rollback)\s*;\s*$/i;

export function unwrapMigrationTransaction(source: string, filename: string): string {
  const normalized = source.replace(/^\uFEFF/, '').trim();
  const wrapper = normalized.match(/^begin\s*;\s*([\s\S]*?)\s*commit\s*;$/i);

  if (!wrapper) {
    throw new Error(`${filename} must have exactly one outer begin/commit transaction wrapper.`);
  }

  const body = wrapper[1].trim();
  if (!body) throw new Error(`${filename} has an empty migration body.`);

  if (body.split(/\r?\n/).some(line => transactionControlLine.test(line))) {
    throw new Error(`${filename} contains nested transaction control.`);
  }

  return `${body}\n`;
}

export async function applyMigrationAtomically(
  runner: MigrationTransactionRunner,
  filename: string,
  source: string,
): Promise<void> {
  const body = unwrapMigrationTransaction(source, filename);

  await runner.begin(async transaction => {
    await transaction.unsafe(body);
    await transaction.record(filename);
  });
}
