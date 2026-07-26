export type InventoryQueueOptions = {
  force: boolean;
  limit: number;
  lookaheadHours: number;
  market?: string;
  product?: string;
  retailer?: string;
};

function option(args: readonly string[], name: string) {
  const prefix = `--${name}=`;
  const inline = args.find(argument => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim();
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1]?.trim() : undefined;
}

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number, label: string) {
  if (value == null || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || String(parsed) !== value || parsed < minimum || parsed > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

export function parseInventoryQueueOptions(args: readonly string[]): InventoryQueueOptions {
  const legacyLimit = args.find(argument => /^\d+$/.test(argument));
  const force = args.includes('--force');
  const market = option(args, 'market')?.toUpperCase();
  const product = option(args, 'product');
  const retailer = option(args, 'retailer');
  const limit = boundedInteger(option(args, 'limit') ?? legacyLimit, 100, 1, 500, 'Limit');
  const lookaheadHours = boundedInteger(option(args, 'lookahead-hours'), 24, 0, 168, 'Lookahead');

  if (market && !/^[A-Z]{2}$/.test(market)) throw new Error('Market must be a two-letter code.');
  if (product && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product)) throw new Error('Product must be a canonical slug.');
  if (retailer && retailer.length > 160) throw new Error('Retailer name is too long.');
  if (force && !market && !product && !retailer) {
    throw new Error('A forced refresh must be scoped by --market, --product, or --retailer.');
  }

  return {
    force,
    limit,
    lookaheadHours,
    ...(market ? { market } : {}),
    ...(product ? { product } : {}),
    ...(retailer ? { retailer } : {}),
  };
}
