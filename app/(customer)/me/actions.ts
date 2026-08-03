'use server';

import { revalidatePath } from 'next/cache';
import { requireCustomer } from '@/lib/customer/access';
import { customerShelfService, type CustomerShelfActionResult } from '@/lib/customer/shelf-service';

function revalidateShelfRoutes(productSlug?: string) {
  revalidatePath('/me', 'layout');
  if (productSlug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productSlug)) {
    revalidatePath(`/me/product/${productSlug}`);
  }
}

export async function addProductToShelfAction(slug: string): Promise<CustomerShelfActionResult> {
  const customer = await requireCustomer();
  const result = await customerShelfService.add(customer, slug);
  if (result.status === 'saved' || result.status === 'already_saved' || result.status === 'conflict') {
    revalidateShelfRoutes(slug);
  }
  return result;
}

export async function removeShelfItemAction(
  identityVersionId: string,
): Promise<CustomerShelfActionResult> {
  const customer = await requireCustomer();
  const result = await customerShelfService.remove(customer, identityVersionId);
  if (result.status === 'removed' || result.status === 'already_removed') {
    revalidateShelfRoutes();
  }
  return result;
}

export async function clearShelfAction(): Promise<CustomerShelfActionResult> {
  const customer = await requireCustomer();
  const result = await customerShelfService.clear(customer);
  if (result.status === 'cleared') revalidateShelfRoutes();
  return result;
}
