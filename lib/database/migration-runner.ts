import {
  assertMigrationMatchesDefinition,
  type MigrationDefinition,
} from "./migration-governance";

export interface MigrationTransaction {
  unsafe(source: string): Promise<unknown>;
  record(migration: MigrationDefinition): Promise<unknown>;
}

export interface MigrationTransactionRunner {
  begin(
    work: (transaction: MigrationTransaction) => Promise<void>,
  ): Promise<void>;
}

const transactionControlStatement =
  /^(?:begin\b|start\s+transaction\b|commit\b|end\b|rollback\b|abort\b|savepoint\b|release(?:\s+savepoint)?\b|prepare\s+transaction\b|set\s+transaction\b|set\s+session\s+characteristics\s+as\s+transaction\b)/i;

function isIdentifierCharacter(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z0-9_$]/.test(character);
}

function dollarQuoteDelimiterAt(source: string, offset: number): string | null {
  if (source[offset] !== "$" || isIdentifierCharacter(source[offset - 1])) {
    return null;
  }

  const match = source.slice(offset).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/);
  return match?.[0] ?? null;
}

function isEscapeStringPrefix(source: string, quoteOffset: number): boolean {
  const prefix = source[quoteOffset - 1];
  return (
    (prefix === "e" || prefix === "E") &&
    !isIdentifierCharacter(source[quoteOffset - 2])
  );
}

function topLevelSqlStatements(source: string, filename: string): string[] {
  const statements: string[] = [];
  let statement = "";
  let offset = 0;

  const finishStatement = () => {
    const normalized = statement.trim();
    if (normalized) statements.push(normalized);
    statement = "";
  };

  while (offset < source.length) {
    const character = source[offset];
    const next = source[offset + 1];

    if (character === "-" && next === "-") {
      statement += " ";
      offset += 2;
      while (offset < source.length && source[offset] !== "\n") offset += 1;
      continue;
    }

    if (character === "/" && next === "*") {
      statement += " ";
      offset += 2;
      let depth = 1;
      while (offset < source.length && depth > 0) {
        if (source[offset] === "/" && source[offset + 1] === "*") {
          depth += 1;
          offset += 2;
        } else if (source[offset] === "*" && source[offset + 1] === "/") {
          depth -= 1;
          offset += 2;
        } else {
          offset += 1;
        }
      }
      if (depth > 0) {
        throw new Error(`${filename} has an unterminated block comment.`);
      }
      continue;
    }

    if (character === "'") {
      statement += " ";
      const escapeString = isEscapeStringPrefix(source, offset);
      offset += 1;
      let terminated = false;
      while (offset < source.length) {
        if (escapeString && source[offset] === "\\") {
          offset += 2;
        } else if (source[offset] === "'" && source[offset + 1] === "'") {
          offset += 2;
        } else if (source[offset] === "'") {
          offset += 1;
          terminated = true;
          break;
        } else {
          offset += 1;
        }
      }
      if (!terminated) {
        throw new Error(`${filename} has an unterminated string literal.`);
      }
      continue;
    }

    if (character === '"') {
      statement += " ";
      offset += 1;
      let terminated = false;
      while (offset < source.length) {
        if (source[offset] === '"' && source[offset + 1] === '"') {
          offset += 2;
        } else if (source[offset] === '"') {
          offset += 1;
          terminated = true;
          break;
        } else {
          offset += 1;
        }
      }
      if (!terminated) {
        throw new Error(`${filename} has an unterminated quoted identifier.`);
      }
      continue;
    }

    const dollarDelimiter = dollarQuoteDelimiterAt(source, offset);
    if (dollarDelimiter) {
      statement += " ";
      const closingOffset = source.indexOf(
        dollarDelimiter,
        offset + dollarDelimiter.length,
      );
      if (closingOffset === -1) {
        throw new Error(`${filename} has an unterminated dollar-quoted body.`);
      }
      offset = closingOffset + dollarDelimiter.length;
      continue;
    }

    if (character === ";") {
      finishStatement();
      offset += 1;
      continue;
    }

    statement += character;
    offset += 1;
  }

  finishStatement();
  return statements;
}

function assertNoNestedTransactionControl(
  source: string,
  filename: string,
): void {
  const nestedControl = topLevelSqlStatements(source, filename).find(
    (statement) => transactionControlStatement.test(statement),
  );
  if (nestedControl) {
    throw new Error(`${filename} contains nested transaction control.`);
  }
}

export function unwrapMigrationTransaction(
  source: string,
  filename: string,
): string {
  const normalized = source.replace(/^\uFEFF/, "").trim();
  const wrapper = normalized.match(/^begin\s*;\s*([\s\S]*?)\s*commit\s*;$/i);

  if (!wrapper) {
    throw new Error(
      `${filename} must have exactly one outer begin/commit transaction wrapper.`,
    );
  }

  const body = wrapper[1].trim();
  if (!body) throw new Error(`${filename} has an empty migration body.`);

  assertNoNestedTransactionControl(body, filename);

  return `${body}\n`;
}

export async function applyMigrationAtomically(
  runner: MigrationTransactionRunner,
  migration: MigrationDefinition,
  source: string,
): Promise<void> {
  assertMigrationMatchesDefinition(migration, source);
  const body = unwrapMigrationTransaction(source, migration.filename);

  await runner.begin(async (transaction) => {
    await transaction.unsafe(body);
    await transaction.record(migration);
  });
}
