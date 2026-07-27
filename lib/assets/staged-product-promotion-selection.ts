const promotionIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * An explicit CLI argument must never silently widen a promotion to every
 * active asset. With no arguments, promoting every active asset is deliberate.
 */
export function parseStagedProductPromotionIds(args: readonly string[]): string[] {
  const ids: string[] = [];

  for (const argument of args) {
    if (!argument.startsWith('--id=')) {
      throw new Error(`Unknown staged asset promotion argument: ${argument}`);
    }
    const id = argument.slice('--id='.length);
    if (!promotionIdPattern.test(id)) {
      throw new Error(`Invalid staged asset promotion ID: ${id || '(empty)'}`);
    }
    ids.push(id);
  }

  if (new Set(ids).size !== ids.length) {
    throw new Error('Each requested promotion ID must be unique.');
  }
  return ids;
}
