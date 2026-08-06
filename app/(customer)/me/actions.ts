'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCustomer } from '@/lib/customer/access';
import { parseCustomerRoutineInput } from '@/lib/customer/routine-input';
import { customerRoutineService } from '@/lib/customer/routine-service';
import { customerShelfService, type CustomerShelfActionResult } from '@/lib/customer/shelf-service';
import { customerConcernService, type CustomerConcernActionResult } from '@/lib/customer/concern-service';

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

export async function addConcernAction(concernSlug: string): Promise<CustomerConcernActionResult> {
  const customer = await requireCustomer();
  const result = await customerConcernService.add(customer, concernSlug);
  if (result.status === 'saved') {
    revalidatePath('/me', 'layout');
  }
  return result;
}

export async function removeConcernAction(concernSlug: string): Promise<CustomerConcernActionResult> {
  const customer = await requireCustomer();
  const result = await customerConcernService.remove(customer, concernSlug);
  if (result.status === 'removed') {
    revalidatePath('/me', 'layout');
  }
  return result;
}

export async function clearConcernsAction(): Promise<CustomerConcernActionResult> {
  const customer = await requireCustomer();
  const result = await customerConcernService.clear(customer);
  if (result.status === 'cleared') revalidatePath('/me', 'layout');
  return result;
}

function finishRoutineMutation(outcome: string): never {
  revalidatePath('/me', 'layout');
  redirect(`/me/routine?outcome=${outcome}`);
}

export async function createRoutineAction(formData: FormData): Promise<void> {
  const customer = await requireCustomer('/me/routine');
  let outcome = 'routine-error';
  try {
    const input = parseCustomerRoutineInput(formData.get('name'), formData.get('steps'));
    const result = await customerRoutineService.create(customer, input);
    outcome = result.status === 'created' ? 'routine-created' : 'routine-error';
  } catch {}
  finishRoutineMutation(outcome);
}

export async function updateRoutineAction(formData: FormData): Promise<void> {
  const customer = await requireCustomer('/me/routine');
  let outcome = 'routine-error';
  try {
    const routineId = String(formData.get('routineId') ?? '');
    const expectedRevision = Number(formData.get('revision'));
    const input = parseCustomerRoutineInput(formData.get('name'), formData.get('steps'));
    const result = await customerRoutineService.update(
      customer,
      routineId,
      expectedRevision,
      input,
    );
    outcome = (
      result.status === 'updated'
        ? 'routine-updated'
        : result.status === 'conflict'
          ? 'routine-conflict'
          : 'routine-error'
    );
  } catch {}
  finishRoutineMutation(outcome);
}

export async function deleteRoutineAction(formData: FormData): Promise<void> {
  const customer = await requireCustomer('/me/routine');
  let outcome = 'routine-error';
  try {
    const routineId = String(formData.get('routineId') ?? '');
    const result = await customerRoutineService.remove(customer, routineId);
    outcome = (
      result.status === 'removed' || result.status === 'already_removed'
        ? 'routine-deleted'
        : 'routine-error'
    );
  } catch {}
  finishRoutineMutation(outcome);
}
