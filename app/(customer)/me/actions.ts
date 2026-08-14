"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCustomer } from "@/lib/customer/access";
import { parseCustomerRoutineInput } from "@/lib/customer/routine-input";
import { customerRoutineService } from "@/lib/customer/routine-service";
import {
  customerShelfService,
  type CustomerShelfActionResult,
} from "@/lib/customer/shelf-service";
import {
  customerConcernService,
  type CustomerConcernActionResult,
} from "@/lib/customer/concern-service";
import {
  customerLocationService,
  type CustomerLocationActionResult,
} from "@/lib/customer/location-service";
import {
  measureCustomerPrivateResultOperation,
  type CustomerPrivateTelemetryOperation,
  type CustomerPrivateTelemetrySurface,
} from "@/lib/customer/private-telemetry";

function measureMeMutation<T>(
  surface: CustomerPrivateTelemetrySurface,
  operation: CustomerPrivateTelemetryOperation,
  mutation: () => Promise<T>,
  succeeded: (value: T) => boolean,
) {
  return measureCustomerPrivateResultOperation(
    { surface, operation },
    mutation,
    succeeded,
  );
}

function revalidateShelfRoutes(productSlug?: string) {
  revalidatePath("/me", "layout");
  if (productSlug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productSlug)) {
    revalidatePath(`/me/product/${productSlug}`);
  }
}

export async function addProductToShelfAction(
  slug: string,
): Promise<CustomerShelfActionResult> {
  const customer = await requireCustomer();
  return measureMeMutation(
    "shelf",
    "add",
    async () => {
      const result = await customerShelfService.add(customer, slug);
      if (
        result.status === "saved" ||
        result.status === "already_saved" ||
        result.status === "conflict"
      ) {
        revalidateShelfRoutes(slug);
      }
      return result;
    },
    (result) =>
      result.status === "saved" || result.status === "already_saved",
  );
}

export async function removeShelfItemAction(
  identityVersionId: string,
): Promise<CustomerShelfActionResult> {
  const customer = await requireCustomer();
  return measureMeMutation(
    "shelf",
    "remove",
    async () => {
      const result = await customerShelfService.remove(
        customer,
        identityVersionId,
      );
      if (result.status === "removed" || result.status === "already_removed") {
        revalidateShelfRoutes();
      }
      return result;
    },
    (result) =>
      result.status === "removed" || result.status === "already_removed",
  );
}

export async function clearShelfAction(): Promise<CustomerShelfActionResult> {
  const customer = await requireCustomer();
  return measureMeMutation(
    "shelf",
    "clear",
    async () => {
      const result = await customerShelfService.clear(customer);
      if (result.status === "cleared") revalidateShelfRoutes();
      return result;
    },
    (result) => result.status === "cleared",
  );
}

export async function addConcernAction(
  concernSlug: string,
): Promise<CustomerConcernActionResult> {
  const customer = await requireCustomer();
  return measureMeMutation(
    "concerns",
    "add",
    async () => {
      const result = await customerConcernService.add(customer, concernSlug);
      if (result.status === "saved") {
        revalidatePath("/me", "layout");
      }
      return result;
    },
    (result) => result.status === "saved",
  );
}

export async function removeConcernAction(
  concernSlug: string,
): Promise<CustomerConcernActionResult> {
  const customer = await requireCustomer();
  return measureMeMutation(
    "concerns",
    "remove",
    async () => {
      const result = await customerConcernService.remove(customer, concernSlug);
      if (result.status === "removed") {
        revalidatePath("/me", "layout");
      }
      return result;
    },
    (result) => result.status === "removed",
  );
}

export async function clearConcernsAction(): Promise<CustomerConcernActionResult> {
  const customer = await requireCustomer();
  return measureMeMutation(
    "concerns",
    "clear",
    async () => {
      const result = await customerConcernService.clear(customer);
      if (result.status === "cleared") revalidatePath("/me", "layout");
      return result;
    },
    (result) => result.status === "cleared",
  );
}

export async function saveLocationAction(
  value: unknown,
): Promise<CustomerLocationActionResult> {
  const customer = await requireCustomer("/me/locations");
  return measureMeMutation(
    "locations",
    "save",
    async () => {
      const result = await customerLocationService.save(customer, value);
      if (result.status === "saved") revalidatePath("/me/locations");
      return result;
    },
    (result) => result.status === "saved",
  );
}

export async function removeLocationAction(
  id: string,
  revision: number,
): Promise<CustomerLocationActionResult> {
  const customer = await requireCustomer("/me/locations");
  return measureMeMutation(
    "locations",
    "remove",
    async () => {
      const result = await customerLocationService.remove(customer, id, revision);
      if (result.status === "removed") revalidatePath("/me/locations");
      return result;
    },
    (result) => result.status === "removed",
  );
}

function finishRoutineMutation(outcome: string): never {
  revalidatePath("/me", "layout");
  redirect(`/me/routine?outcome=${outcome}`);
}

export async function createRoutineAction(formData: FormData): Promise<void> {
  const customer = await requireCustomer("/me/routine");
  let outcome = "routine-error";
  try {
    await measureMeMutation(
      "routine",
      "create",
      async () => {
        const input = parseCustomerRoutineInput(
          formData.get("name"),
          formData.get("steps"),
        );
        const result = await customerRoutineService.create(customer, input);
        outcome =
          result.status === "created" ? "routine-created" : "routine-error";
        return result;
      },
      (result) => result.status === "created",
    );
  } catch {}
  finishRoutineMutation(outcome);
}

export async function updateRoutineAction(formData: FormData): Promise<void> {
  const customer = await requireCustomer("/me/routine");
  let outcome = "routine-error";
  try {
    await measureMeMutation(
      "routine",
      "update",
      async () => {
        const routineId = String(formData.get("routineId") ?? "");
        const expectedRevision = Number(formData.get("revision"));
        const input = parseCustomerRoutineInput(
          formData.get("name"),
          formData.get("steps"),
        );
        const result = await customerRoutineService.update(
          customer,
          routineId,
          expectedRevision,
          input,
        );
        outcome =
          result.status === "updated"
            ? "routine-updated"
            : result.status === "conflict"
              ? "routine-conflict"
              : "routine-error";
        return result;
      },
      (result) => result.status === "updated",
    );
  } catch {}
  finishRoutineMutation(outcome);
}

export async function deleteRoutineAction(formData: FormData): Promise<void> {
  const customer = await requireCustomer("/me/routine");
  let outcome = "routine-error";
  try {
    await measureMeMutation(
      "routine",
      "delete",
      async () => {
        const routineId = String(formData.get("routineId") ?? "");
        const result = await customerRoutineService.remove(customer, routineId);
        outcome =
          result.status === "removed" || result.status === "already_removed"
            ? "routine-deleted"
            : "routine-error";
        return result;
      },
      (result) =>
        result.status === "removed" || result.status === "already_removed",
    );
  } catch {}
  finishRoutineMutation(outcome);
}
