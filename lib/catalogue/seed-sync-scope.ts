const PRODUCT_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type CatalogueSeedScope = {
  readonly requestedSlugs: readonly string[];
  readonly isScoped: boolean;
};

export type CatalogueSyncTimeouts = {
  readonly lockTimeoutMs: number;
  readonly statementTimeoutMs: number;
};

type Slugged = { slug: string };

function positiveMilliseconds(
  value: string | undefined,
  fallback: number,
  name: string,
) {
  if (value == null || value === '') return fallback;
  if (!/^\d+$/.test(value) || Number(value) < 1) {
    throw new Error(`${name} must be a positive whole number of milliseconds.`);
  }
  return Number(value);
}

/**
 * Parse a deliberately small sync CLI surface. A scope preserves the checked-in
 * catalogue order, never caller order, so retries and logs are deterministic.
 */
export function parseCatalogueSeedScope(
  args: readonly string[],
): CatalogueSeedScope {
  const slugs: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument !== '--only') {
      throw new Error(`Unknown catalogue sync argument: ${argument}`);
    }

    const slug = args[index + 1];
    if (!slug || slug.startsWith('--')) {
      throw new Error('Missing product slug after --only.');
    }
    if (!PRODUCT_SLUG.test(slug)) {
      throw new Error(`Invalid product slug: ${slug}`);
    }

    slugs.push(slug);
    index += 1;
  }

  return {
    requestedSlugs: [...new Set(slugs)],
    isScoped: slugs.length > 0,
  };
}

/** Select only known products while retaining the canonical catalogue ordering. */
export function selectCatalogueSeedProducts<T extends Slugged>(
  catalogue: readonly T[],
  scope: CatalogueSeedScope,
): readonly T[] {
  if (!scope.isScoped) return catalogue;

  const requested = new Set(scope.requestedSlugs);
  const selected = catalogue.filter((product) => requested.has(product.slug));
  const known = new Set(selected.map((product) => product.slug));
  const missing = scope.requestedSlugs.filter((slug) => !known.has(slug));

  if (missing.length) {
    throw new Error(
      `Unknown public catalogue product${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`,
    );
  }

  return selected;
}

/** A targeted repair must never retire an unrelated public product. */
export function shouldRetireStaleCatalogueProducts(scope: CatalogueSeedScope) {
  return !scope.isScoped;
}

/**
 * Every transaction is bounded. The seed may take several short commits, but
 * no single blocked statement can hold the reviewed catalogue hostage.
 */
export function catalogueSyncTimeouts(
  env: Partial<
    Record<
      'CATALOGUE_SYNC_LOCK_TIMEOUT_MS' | 'CATALOGUE_SYNC_STATEMENT_TIMEOUT_MS',
      string | undefined
    >
  >,
): CatalogueSyncTimeouts {
  const lockTimeoutMs = positiveMilliseconds(
    env.CATALOGUE_SYNC_LOCK_TIMEOUT_MS,
    5_000,
    'CATALOGUE_SYNC_LOCK_TIMEOUT_MS',
  );
  const statementTimeoutMs = positiveMilliseconds(
    env.CATALOGUE_SYNC_STATEMENT_TIMEOUT_MS,
    45_000,
    'CATALOGUE_SYNC_STATEMENT_TIMEOUT_MS',
  );

  if (statementTimeoutMs < lockTimeoutMs) {
    throw new Error(
      'CATALOGUE_SYNC_STATEMENT_TIMEOUT_MS cannot be lower than CATALOGUE_SYNC_LOCK_TIMEOUT_MS.',
    );
  }

  return { lockTimeoutMs, statementTimeoutMs };
}
