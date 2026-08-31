import 'server-only';

import { redirect } from 'next/navigation';
import {
  customerSignInPath,
  customerSignInRecoveryPath,
} from '@/lib/auth/sign-in-intent';
import { getAuthSubjectResult } from '@/lib/auth/subject';
import {
  isDevelopmentCustomerFixtureEnabled,
  sessionCustomerIdentity,
  type CustomerAccessIdentity,
} from './access-policy';
import { SYNTHETIC_CUSTOMER_IDENTITY } from './development-fixture';

type CustomerIdentityResult =
  | { status: 'authenticated'; identity: CustomerAccessIdentity }
  | { status: 'signed-out' }
  | { status: 'unavailable' };

async function getCustomerIdentityResult(): Promise<CustomerIdentityResult> {
  if (isDevelopmentCustomerFixtureEnabled(process.env)) {
    return { status: 'authenticated', identity: SYNTHETIC_CUSTOMER_IDENTITY };
  }

  const result = await getAuthSubjectResult();
  if (result.status !== 'authenticated') return result;
  return {
    status: 'authenticated',
    identity: sessionCustomerIdentity(result.identity),
  };
}

export async function getCustomerIdentity(): Promise<CustomerAccessIdentity | null> {
  const result = await getCustomerIdentityResult();
  return result.status === 'authenticated' ? result.identity : null;
}

export async function requireCustomer(
  continuation?: string | readonly string[] | null,
): Promise<CustomerAccessIdentity> {
  const result = await getCustomerIdentityResult();
  if (result.status === 'authenticated') return result.identity;

  if (result.status === 'unavailable') {
    if (continuation === undefined) redirect(customerSignInRecoveryPath());
    redirect(customerSignInRecoveryPath(continuation));
  }

  if (continuation === undefined) redirect(customerSignInPath());
  redirect(customerSignInPath(continuation));
}
