import { timingSafeEqual } from 'node:crypto';

export function isAuthorizedCronRequest(authorization: string | null, secret: string | undefined) {
  if (!secret || secret.length < 16 || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const supplied = Buffer.from(authorization);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
