import "server-only";

import type { CustomerAccessIdentity } from "./access-policy";
import { isValidCustomerShelfOwnerSubject } from "./shelf-policy";
import type { SavedCustomerLocation } from "@/lib/location/model";
import {
  savedCustomerLocationInputSchema,
  type SavedCustomerLocationInput,
} from "@/lib/location/schema";
import {
  postgresCustomerLocationRepository,
  type CustomerLocationRepository,
} from "./location-repository";

export type CustomerLocationReadResult =
  | { status: "ready"; locations: SavedCustomerLocation[] }
  | { status: "unavailable"; locations: []; message: string };

export type CustomerLocationActionResult = {
  status: "saved" | "removed" | "conflict" | "limit" | "error";
  message: string;
  location?: SavedCustomerLocation;
};

export function createCustomerLocationService(
  repository: CustomerLocationRepository,
) {
  function canUse(identity: CustomerAccessIdentity) {
    return (
      identity.source === "session" &&
      isValidCustomerShelfOwnerSubject(identity.subject)
    );
  }
  return {
    async read(
      identity: CustomerAccessIdentity,
    ): Promise<CustomerLocationReadResult> {
      if (!canUse(identity))
        return {
          status: "unavailable",
          locations: [],
          message: "Saved locations are unavailable in preview.",
        };
      try {
        return {
          status: "ready",
          locations: await repository.list(identity.subject),
        };
      } catch {
        console.error("Customer saved-location read unavailable.");
        return {
          status: "unavailable",
          locations: [],
          message:
            "Saved locations are unavailable right now. Enter an address manually.",
        };
      }
    },

    async save(
      identity: CustomerAccessIdentity,
      value: unknown,
    ): Promise<CustomerLocationActionResult> {
      if (!canUse(identity))
        return { status: "error", message: "Could not save this location." };
      const parsed = savedCustomerLocationInputSchema.safeParse(value);
      if (!parsed.success)
        return {
          status: "error",
          message: "Check the location details and try again.",
        };
      const input: SavedCustomerLocationInput = parsed.data;
      try {
        if (input.id && input.revision !== undefined) {
          const location = await repository.update(identity.subject, {
            ...input,
            id: input.id,
            revision: input.revision,
          });
          return location
            ? { status: "saved", message: "Location updated.", location }
            : {
                status: "conflict",
                message:
                  "This location changed elsewhere. Refresh and try again.",
              };
        }
        const location = await repository.create(identity.subject, input);
        return { status: "saved", message: "Location saved.", location };
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "saved_location_limit"
        ) {
          return {
            status: "limit",
            message:
              "You can save up to 8 locations. Remove one before adding another.",
          };
        }
        console.error("Customer saved-location mutation unavailable.");
        return {
          status: "error",
          message: "Could not save this location. Try again.",
        };
      }
    },

    async remove(
      identity: CustomerAccessIdentity,
      id: string,
      revision: number,
    ): Promise<CustomerLocationActionResult> {
      if (
        !canUse(identity) ||
        !/^[0-9a-f-]{36}$/i.test(id) ||
        !Number.isInteger(revision) ||
        revision < 1
      ) {
        return { status: "error", message: "Could not remove this location." };
      }
      try {
        return (await repository.remove(identity.subject, id, revision))
          ? { status: "removed", message: "Location removed." }
          : {
              status: "conflict",
              message:
                "This location changed elsewhere. Refresh and try again.",
            };
      } catch {
        console.error("Customer saved-location removal unavailable.");
        return {
          status: "error",
          message: "Could not remove this location. Try again.",
        };
      }
    },
  };
}

export const customerLocationService = createCustomerLocationService(
  postgresCustomerLocationRepository,
);
