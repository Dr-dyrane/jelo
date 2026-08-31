import "server-only";

import type { CustomerIdentityResult } from "./access";
import { customerConcernService } from "./concern-service";
import { createSyntheticCustomerPortal } from "./development-fixture";
import { customerRoutineService } from "./routine-service";
import { customerShelfService } from "./shelf-service";

export type SubmittedCustomerConsultContext = {
  concernSlugs: readonly string[];
  productSlugs: readonly string[];
};

export type CustomerConsultContextDependencies = {
  readConcerns: typeof customerConcernService.read;
  readShelf: typeof customerShelfService.read;
  readRoutines: typeof customerRoutineService.read;
  readSyntheticPortal: typeof createSyntheticCustomerPortal;
};

const defaultDependencies: CustomerConsultContextDependencies = {
  readConcerns: customerConcernService.read,
  readShelf: customerShelfService.read,
  readRoutines: customerRoutineService.read,
  readSyntheticPortal: createSyntheticCustomerPortal,
};

function selectedOwnedSlugs(
  submitted: readonly string[],
  owned: ReadonlySet<string>,
) {
  return [...new Set(submitted.filter((slug) => owned.has(slug)))];
}

export async function resolveCustomerConsultContext(
  customerResult: CustomerIdentityResult,
  submitted: SubmittedCustomerConsultContext | undefined,
  dependencies: CustomerConsultContextDependencies = defaultDependencies,
) {
  if (!submitted) return { status: "not-requested" as const };
  const concernsSelected = submitted.concernSlugs.length > 0;
  const productsSelected = submitted.productSlugs.length > 0;
  if (!concernsSelected && !productsSelected) {
    return { status: "not-requested" as const };
  }
  if (customerResult.status === "signed-out") {
    return { status: "signed-out" as const };
  }
  if (customerResult.status === "unavailable") {
    return { status: "unavailable" as const };
  }

  const customer = customerResult.identity;
  try {
    const ownedConcernSlugs = new Set<string>();
    const ownedProductSlugs = new Set<string>();
    if (customer.source === "synthetic-development") {
      const portal = dependencies.readSyntheticPortal();
      if (concernsSelected) {
        for (const concern of portal.concerns) {
          ownedConcernSlugs.add(concern.slug);
        }
      }
      if (productsSelected) {
        for (const item of portal.shelf) {
          if (item.lifecycleState === "active" && item.product) {
            ownedProductSlugs.add(item.product.slug);
          }
        }
        for (const routine of portal.routines ?? []) {
          for (const step of routine.steps) {
            if (step.referenceState === "catalogue" && step.product) {
              ownedProductSlugs.add(step.product.slug);
            }
          }
        }
      }
    } else if (concernsSelected) {
      const concerns = await dependencies.readConcerns(customer);
      if (concerns.status !== "ready") {
        return { status: "unavailable" as const };
      }
      for (const concern of concerns.concerns) {
        ownedConcernSlugs.add(concern.concernSlug);
      }
    }

    if (customer.source === "session" && productsSelected) {
      const [shelf, routines] = await Promise.all([
        dependencies.readShelf(customer),
        dependencies.readRoutines(customer),
      ]);
      if (shelf.status !== "ready" || routines.status !== "ready") {
        return { status: "unavailable" as const };
      }

      for (const item of shelf.items) {
        if (
          item.lifecycleState === "active" &&
          item.currentProductPublished &&
          item.currentSlug
        ) {
          ownedProductSlugs.add(item.currentSlug);
        }
      }
      for (const routine of routines.routines) {
        for (const step of routine.steps) {
          if (
            step.referenceState === "catalogue" &&
            step.productLifecycleState === "active" &&
            step.currentProductPublished &&
            step.currentProductSlug
          ) {
            ownedProductSlugs.add(step.currentProductSlug);
          }
        }
      }
    }

    return {
      status: "ready" as const,
      context: {
        concernSlugs: selectedOwnedSlugs(
          submitted.concernSlugs,
          ownedConcernSlugs,
        ),
        productSlugs: selectedOwnedSlugs(
          submitted.productSlugs,
          ownedProductSlugs,
        ),
      },
    };
  } catch {
    return { status: "unavailable" as const };
  }
}
