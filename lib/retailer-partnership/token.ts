export function retailerPartnershipToken(applicationId: string, secret: string) {
  return `${applicationId}.${secret}`;
}

export function parseRetailerPartnershipToken(token: string | null) {
  if (!token) return null;
  const separator = token.indexOf('.');
  if (separator < 1) return null;
  const applicationId = token.slice(0, separator);
  const secret = token.slice(separator + 1);
  if (!isUuid(applicationId) || secret.length < 32) return null;
  return { applicationId, secret };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
