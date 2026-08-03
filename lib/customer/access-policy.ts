import type { AuthIdentity } from '@/lib/auth/subject';

export const SYNTHETIC_CUSTOMER_ENV_FLAG = 'JELOCARE_ENABLE_SYNTHETIC_CUSTOMER';

type CustomerFixtureEnvironment = {
  NODE_ENV?: string;
  JELOCARE_ENABLE_SYNTHETIC_CUSTOMER?: string;
};

export type CustomerAccessIdentity = AuthIdentity & {
  displayName: string | null;
  preferredFirstName: string | null;
  source: 'session' | 'synthetic-development';
};

const CONTROL_OR_FORMAT = /[\p{Cc}\p{Cf}]/gu;
const LETTER_LED_NAME_TOKEN = /^\p{L}[\p{L}\p{M}'’\-]*$/u;
const URL_OR_MAILBOX = /@|:\/\/|\bwww\.|\/|\b[\p{L}\d-]+\.(?:com|net|org|io|co|ng|app)\b/iu;
const MAX_PREFERRED_NAME_CODEPOINTS = 32;

export function preferredCustomerFirstName(name: string | null | undefined): string | null {
  if (!name) return null;
  const normalized = name
    .normalize('NFKC')
    .replace(CONTROL_OR_FORMAT, '')
    .replace(/\s+/gu, ' ')
    .trim();
  if (!normalized || URL_OR_MAILBOX.test(normalized)) return null;

  const [firstToken] = normalized.split(' ');
  if (!firstToken || !LETTER_LED_NAME_TOKEN.test(firstToken)) return null;
  return [...firstToken].slice(0, MAX_PREFERRED_NAME_CODEPOINTS).join('') || null;
}

export function isDevelopmentCustomerFixtureEnabled(
  environment: CustomerFixtureEnvironment,
): boolean {
  return environment.NODE_ENV === 'development'
    && environment.JELOCARE_ENABLE_SYNTHETIC_CUSTOMER === 'true';
}

export function sessionCustomerIdentity(identity: AuthIdentity): CustomerAccessIdentity {
  const preferredFirstName = preferredCustomerFirstName(identity.name);
  return {
    ...identity,
    displayName: preferredFirstName,
    preferredFirstName,
    source: 'session',
  };
}
