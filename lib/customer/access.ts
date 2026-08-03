import 'server-only';

import { redirect } from 'next/navigation';
import { customerSignInPath } from '@/lib/auth/sign-in-intent';
import { getAuthSubject } from '@/lib/auth/subject';
import {
  isDevelopmentCustomerFixtureEnabled,
  sessionCustomerIdentity,
  type CustomerAccessIdentity,
} from './access-policy';
import { SYNTHETIC_CUSTOMER_IDENTITY } from './development-fixture';

export async function getCustomerIdentity(): Promise<CustomerAccessIdentity | null> {
  if (isDevelopmentCustomerFixtureEnabled(process.env)) {
    return SYNTHETIC_CUSTOMER_IDENTITY;
  }

  const identity = await getAuthSubject();
  return identity ? sessionCustomerIdentity(identity) : null;
}

export async function requireCustomer(): Promise<CustomerAccessIdentity> {
  const identity = await getCustomerIdentity();
  if (!identity) redirect(customerSignInPath());
  return identity;
}
