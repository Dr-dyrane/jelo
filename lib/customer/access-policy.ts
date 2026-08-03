import type { AuthIdentity } from '@/lib/auth/subject';

export const SYNTHETIC_CUSTOMER_ENV_FLAG = 'JELOCARE_ENABLE_SYNTHETIC_CUSTOMER';

type CustomerFixtureEnvironment = {
  NODE_ENV?: string;
  JELOCARE_ENABLE_SYNTHETIC_CUSTOMER?: string;
};

export type CustomerAccessIdentity = AuthIdentity & {
  displayName: string | null;
  source: 'session' | 'synthetic-development';
};

export function isDevelopmentCustomerFixtureEnabled(
  environment: CustomerFixtureEnvironment,
): boolean {
  return environment.NODE_ENV === 'development'
    && environment.JELOCARE_ENABLE_SYNTHETIC_CUSTOMER === 'true';
}

export function sessionCustomerIdentity(identity: AuthIdentity): CustomerAccessIdentity {
  return {
    ...identity,
    displayName: null,
    source: 'session',
  };
}
