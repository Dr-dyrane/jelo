import { z } from 'zod';
import type { InventoryStatus } from '@/modules/retail-intelligence/extraction';

const productSlug = z.string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Product must be a canonical slug.');
const retailer = z.string().trim().min(1).max(160);
const prose = z.string().trim().min(1).max(2_000);
const observedValue = z.string().trim().min(1).max(500);
const stock = z.enum(['in_stock', 'low_stock', 'out_of_stock', 'unknown']);
const allowedFlags = new Set([
  'product-slug',
  'retailer',
  'url',
  'market-code',
  'price-naira',
  'stock',
  'observed-title',
  'observed-size',
  'evidence-note',
  'rationale',
  'valid-for-hours',
  'apply',
]);

export type ManualObservationCommand = {
  productSlug: string;
  retailer: string;
  url?: string;
  marketCode?: string;
  priceNaira?: number;
  stock: InventoryStatus;
  observedTitle: string;
  observedSize: string;
  evidenceNote: string;
  rationale: string;
  validForHours: number;
  apply: boolean;
};

function readFlags(argv: readonly string[]) {
  const flags = new Map<string, string | true>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    if (!allowedFlags.has(key)) throw new Error(`Unknown flag: --${key}`);
    if (flags.has(key)) throw new Error(`Duplicate flag: --${key}`);
    if (key === 'apply') {
      flags.set(key, true);
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    flags.set(key, value);
    index += 1;
  }
  return flags;
}

function required(flags: Map<string, string | true>, key: string) {
  const value = flags.get(key);
  if (typeof value !== 'string') throw new Error(`--${key} is required.`);
  return value;
}

function optional(flags: Map<string, string | true>, key: string) {
  const value = flags.get(key);
  return typeof value === 'string' ? value : undefined;
}

function parseHttpsUrl(value: string) {
  const url = z.url().parse(value.trim());
  if (new URL(url).protocol !== 'https:') throw new Error('URL must use https.');
  return url;
}

function parseMarketCode(value: string) {
  const normalized = value.trim().toUpperCase();
  return z.string()
    .regex(/^[A-Z]{2,8}$/, 'Market code must contain 2–8 uppercase letters.')
    .parse(normalized);
}

function parseWholeNaira(value: string | undefined) {
  if (value == null) return undefined;
  const normalized = value.trim();
  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new Error('Price must be a positive whole-naira amount.');
  }
  const amount = Number(normalized);
  if (!Number.isSafeInteger(amount)) throw new Error('Price is too large to store safely.');
  return amount;
}

function parseValidity(value: string | undefined) {
  if (value == null) return 72;
  if (!/^[1-9]\d*$/.test(value)) throw new Error('Validity must be a whole number of hours between 1 and 168.');
  const hours = Number(value);
  if (!Number.isSafeInteger(hours) || hours < 1 || hours > 168) {
    throw new Error('Validity must be a whole number of hours between 1 and 168.');
  }
  return hours;
}

export function parseManualObservationCommand(argv: readonly string[]): ManualObservationCommand {
  const flags = readFlags(argv);
  const priceNaira = parseWholeNaira(optional(flags, 'price-naira'));
  return {
    productSlug: productSlug.parse(required(flags, 'product-slug')),
    retailer: retailer.parse(required(flags, 'retailer')),
    ...(optional(flags, 'url') ? { url: parseHttpsUrl(optional(flags, 'url')!) } : {}),
    ...(optional(flags, 'market-code') ? { marketCode: parseMarketCode(optional(flags, 'market-code')!) } : {}),
    ...(priceNaira != null
      ? { priceNaira }
      : {}),
    stock: stock.parse(required(flags, 'stock')),
    observedTitle: observedValue.parse(required(flags, 'observed-title')),
    observedSize: observedValue.parse(required(flags, 'observed-size')),
    evidenceNote: prose.parse(required(flags, 'evidence-note')),
    rationale: prose.parse(required(flags, 'rationale')),
    validForHours: parseValidity(optional(flags, 'valid-for-hours')),
    apply: flags.get('apply') === true,
  };
}
