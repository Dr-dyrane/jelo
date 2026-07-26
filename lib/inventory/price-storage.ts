/**
 * Convert a retailer-facing price amount into JeloCare's existing database unit.
 *
 * Historical NGN rows use whole naira, while other currencies use their
 * two-decimal minor unit. The database columns are bigint, so every write must
 * cross this boundary as a safe integer.
 */
export function priceAmountToStorageInteger(amount: number, currencyCode: string) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Cannot store invalid ${currencyCode} price amount: ${amount}.`);
  }

  const storageValue = Math.round(amount * (currencyCode === 'NGN' ? 1 : 100));
  if (!Number.isSafeInteger(storageValue)) {
    throw new Error(`Cannot store unsafe ${currencyCode} price amount: ${amount}.`);
  }

  return storageValue;
}
