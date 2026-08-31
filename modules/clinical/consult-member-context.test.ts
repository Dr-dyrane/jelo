import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { POST } from "@/app/api/consult/route";
import {
  resolveCustomerConsultContext,
  type CustomerConsultContextDependencies,
} from "@/lib/customer/consult-context";
import type { CustomerIdentityResult } from "@/lib/customer/access";
import {
  createSyntheticCustomerPortal,
  SYNTHETIC_CUSTOMER_IDENTITY,
  SYNTHETIC_SHELF_PRODUCT_SLUGS,
} from "@/lib/customer/development-fixture";

const authenticated: CustomerIdentityResult = {
  status: "authenticated",
  identity: {
    subject: "customer:owner-a",
    email: "owner@example.test",
    emailVerified: true,
    name: "Owner A",
    displayName: "Owner A",
    preferredFirstName: "Owner",
    source: "session",
  },
};

function dependencies(
  overrides: Partial<CustomerConsultContextDependencies> = {},
): CustomerConsultContextDependencies {
  return {
    readConcerns: async () => ({
      status: "ready",
      concerns: [
        {
          concernSlug: "owned-concern",
          savedAt: "2026-08-31T12:00:00.000Z",
          origin: "customer",
        },
      ],
    }),
    readShelf: async () => ({
      status: "ready",
      items: [
        {
          identityVersionId: "11111111-1111-1111-1111-111111111111",
          savedAt: "2026-08-31T12:00:00.000Z",
          saveOrigin: "customer",
          lifecycleState: "active",
          snapshot: {
            slug: "owned-shelf-product",
            brand: "Brand",
            name: "Owned Shelf Product",
            size: "50 ml",
            versionNumber: 1,
            packageVersion: "1",
            formulaVersion: "1",
          },
          currentSlug: "owned-shelf-product",
          currentProductPublished: true,
        },
        {
          identityVersionId: "22222222-2222-2222-2222-222222222222",
          savedAt: "2026-08-31T12:00:00.000Z",
          saveOrigin: "customer",
          lifecycleState: "retired",
          snapshot: {
            slug: "retired-shelf-product",
            brand: "Brand",
            name: "Retired Shelf Product",
            size: "50 ml",
            versionNumber: 1,
            packageVersion: "1",
            formulaVersion: "1",
          },
          currentSlug: "retired-shelf-product",
          currentProductPublished: true,
        },
      ],
    }),
    readRoutines: async () => ({
      status: "ready",
      routines: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          revision: 0,
          name: "Morning",
          origin: "customer",
          createdAt: "2026-08-31T12:00:00.000Z",
          updatedAt: "2026-08-31T12:00:00.000Z",
          steps: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              position: 1,
              label: "Use owned product",
              instruction: "Use gently.",
              referenceState: "catalogue",
              productIdentityVersionId: "55555555-5555-5555-5555-555555555555",
              productRequestId: null,
              productLifecycleState: "active",
              currentProductSlug: "owned-routine-product",
              currentProductPublished: true,
            },
            {
              id: "66666666-6666-4666-8666-666666666666",
              position: 2,
              label: "Unavailable product",
              instruction: "",
              referenceState: "catalogue",
              productIdentityVersionId: "77777777-7777-7777-7777-777777777777",
              productRequestId: null,
              productLifecycleState: "active",
              currentProductSlug: "unpublished-routine-product",
              currentProductPublished: false,
            },
          ],
        },
      ],
    }),
    readSyntheticPortal: createSyntheticCustomerPortal,
    ...overrides,
  };
}

test("public Ask does not read private context when none was submitted", async () => {
  let reads = 0;
  const readers = dependencies({
    readConcerns: async () => {
      reads += 1;
      throw new Error("unexpected private read");
    },
  });

  assert.deepEqual(
    await resolveCustomerConsultContext(
      { status: "unavailable" },
      undefined,
      readers,
    ),
    { status: "not-requested" },
  );
  assert.equal(reads, 0);
});

test("an empty member context performs no private reads or authentication error", async () => {
  let reads = 0;
  const readers = dependencies({
    readConcerns: async () => {
      reads += 1;
      throw new Error("unexpected concern read");
    },
    readShelf: async () => {
      reads += 1;
      throw new Error("unexpected shelf read");
    },
    readRoutines: async () => {
      reads += 1;
      throw new Error("unexpected routine read");
    },
  });

  assert.deepEqual(
    await resolveCustomerConsultContext(
      { status: "signed-out" },
      { concernSlugs: [], productSlugs: [] },
      readers,
    ),
    { status: "not-requested" },
  );
  assert.equal(reads, 0);
});

test("signed-out or unavailable authentication cannot supply selected member context", async () => {
  const submitted = { concernSlugs: ["owned-concern"], productSlugs: [] };
  assert.deepEqual(
    await resolveCustomerConsultContext(
      { status: "signed-out" },
      submitted,
      dependencies(),
    ),
    { status: "signed-out" },
  );
  assert.deepEqual(
    await resolveCustomerConsultContext(
      { status: "unavailable" },
      submitted,
      dependencies(),
    ),
    { status: "unavailable" },
  );
});

test("concern-only context reads Concern but not Shelf or Routine", async () => {
  const reads = { concerns: 0, shelf: 0, routines: 0 };
  const readers = dependencies({
    readConcerns: async (customer) => {
      reads.concerns += 1;
      return dependencies().readConcerns(customer);
    },
    readShelf: async () => {
      reads.shelf += 1;
      throw new Error("unexpected shelf read");
    },
    readRoutines: async () => {
      reads.routines += 1;
      throw new Error("unexpected routine read");
    },
  });

  assert.deepEqual(
    await resolveCustomerConsultContext(
      authenticated,
      { concernSlugs: ["owned-concern"], productSlugs: [] },
      readers,
    ),
    {
      status: "ready",
      context: { concernSlugs: ["owned-concern"], productSlugs: [] },
    },
  );
  assert.deepEqual(reads, { concerns: 1, shelf: 0, routines: 0 });
});

test("product-only context reads Shelf and Routine but not Concern", async () => {
  const reads = { concerns: 0, shelf: 0, routines: 0 };
  const defaults = dependencies();
  const readers = dependencies({
    readConcerns: async () => {
      reads.concerns += 1;
      throw new Error("unexpected concern read");
    },
    readShelf: async (customer) => {
      reads.shelf += 1;
      return defaults.readShelf(customer);
    },
    readRoutines: async (customer) => {
      reads.routines += 1;
      return defaults.readRoutines(customer);
    },
  });

  assert.deepEqual(
    await resolveCustomerConsultContext(
      authenticated,
      { concernSlugs: [], productSlugs: ["owned-routine-product"] },
      readers,
    ),
    {
      status: "ready",
      context: { concernSlugs: [], productSlugs: ["owned-routine-product"] },
    },
  );
  assert.deepEqual(reads, { concerns: 0, shelf: 1, routines: 1 });
});

test("synthetic member context is derived from the development fixture", async () => {
  let repositoryReads = 0;
  const selectedSlug = SYNTHETIC_SHELF_PRODUCT_SLUGS[0];
  assert.ok(selectedSlug);
  const readers = dependencies({
    readConcerns: async () => {
      repositoryReads += 1;
      throw new Error("unexpected concern repository read");
    },
    readShelf: async () => {
      repositoryReads += 1;
      throw new Error("unexpected shelf repository read");
    },
    readRoutines: async () => {
      repositoryReads += 1;
      throw new Error("unexpected routine repository read");
    },
  });

  assert.deepEqual(
    await resolveCustomerConsultContext(
      { status: "authenticated", identity: SYNTHETIC_CUSTOMER_IDENTITY },
      {
        concernSlugs: [],
        productSlugs: ["forged-product", selectedSlug],
      },
      readers,
    ),
    {
      status: "ready",
      context: { concernSlugs: [], productSlugs: [selectedSlug] },
    },
  );
  assert.equal(repositoryReads, 0);
});

test("submitted context is intersected with active owner-derived context", async () => {
  const result = await resolveCustomerConsultContext(
    authenticated,
    {
      concernSlugs: ["forged-concern", "owned-concern", "owned-concern"],
      productSlugs: [
        "forged-product",
        "retired-shelf-product",
        "unpublished-routine-product",
        "owned-routine-product",
        "owned-shelf-product",
        "owned-shelf-product",
      ],
    },
    dependencies(),
  );

  assert.deepEqual(result, {
    status: "ready",
    context: {
      concernSlugs: ["owned-concern"],
      productSlugs: ["owned-routine-product", "owned-shelf-product"],
    },
  });
  assert.doesNotMatch(JSON.stringify(result), /forged|retired|unpublished/);
});

test("any owner-context read failure rejects all submitted claims", async () => {
  const submitted = {
    concernSlugs: ["owned-concern"],
    productSlugs: ["owned-shelf-product"],
  };
  const unavailable = await resolveCustomerConsultContext(
    authenticated,
    submitted,
    dependencies({
      readRoutines: async () => ({
        status: "unavailable",
        routines: [],
        message: "Routine is unavailable right now. Try again.",
      }),
    }),
  );
  const thrown = await resolveCustomerConsultContext(
    authenticated,
    submitted,
    dependencies({
      readShelf: async () => {
        throw new Error("private provider detail");
      },
    }),
  );

  assert.deepEqual(unavailable, { status: "unavailable" });
  assert.deepEqual(thrown, { status: "unavailable" });
});

test("a selected Concern fails closed when Concern ownership is unavailable", async () => {
  const result = await resolveCustomerConsultContext(
    authenticated,
    { concernSlugs: ["owned-concern"], productSlugs: [] },
    dependencies({
      readConcerns: async () => ({
        status: "unavailable",
        concerns: [],
        message: "Concerns are unavailable right now. Try again.",
      }),
      readShelf: async () => {
        throw new Error("unexpected shelf read");
      },
      readRoutines: async () => {
        throw new Error("unexpected routine read");
      },
    }),
  );

  assert.deepEqual(result, { status: "unavailable" });
});

test("a successful selected-context response is private and no-store", async () => {
  const originalNodeEnvironment = process.env.NODE_ENV;
  const originalSyntheticFlag = process.env.JELOCARE_ENABLE_SYNTHETIC_CUSTOMER;
  Reflect.set(process.env, "NODE_ENV", "development");
  Reflect.set(process.env, "JELOCARE_ENABLE_SYNTHETIC_CUSTOMER", "true");

  try {
    const selectedSlug = SYNTHETIC_SHELF_PRODUCT_SLUGS[0];
    assert.ok(selectedSlug);
    const response = await POST(
      new Request("http://localhost/api/consult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "I need sunscreen for every day.",
          market: "NG",
          clientSchemaVersion: 2,
          memberContext: {
            concernSlugs: [],
            productSlugs: [selectedSlug],
          },
        }),
      }),
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.meta.ordinaryCare, true);
    assert.equal(
      response.headers.get("Cache-Control"),
      "private, no-store, max-age=0",
    );
  } finally {
    if (originalNodeEnvironment === undefined) {
      Reflect.deleteProperty(process.env, "NODE_ENV");
    } else {
      Reflect.set(process.env, "NODE_ENV", originalNodeEnvironment);
    }
    if (originalSyntheticFlag === undefined) {
      Reflect.deleteProperty(process.env, "JELOCARE_ENABLE_SYNTHETIC_CUSTOMER");
    } else {
      Reflect.set(
        process.env,
        "JELOCARE_ENABLE_SYNTHETIC_CUSTOMER",
        originalSyntheticFlag,
      );
    }
  }
});

test("public and baseline emergency responses retain public cache behavior", async () => {
  const publicResponse = await POST(
    new Request("http://localhost/api/consult", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "I need sunscreen for every day.",
        market: "NG",
        clientSchemaVersion: 2,
      }),
    }),
  );
  const emergencyResponse = await POST(
    new Request("http://localhost/api/consult", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "My lips are swelling and I am having trouble breathing.",
        market: "NG",
        clientSchemaVersion: 2,
        memberContext: {
          concernSlugs: ["forged-private-concern"],
          productSlugs: ["forged-private-product"],
        },
      }),
    }),
  );

  assert.equal(publicResponse.status, 200);
  assert.equal(publicResponse.headers.get("Cache-Control"), null);
  assert.equal(emergencyResponse.status, 200);
  assert.equal(emergencyResponse.headers.get("Cache-Control"), null);
});

test("the consult route uses only resolved owner context and returns private-safe failures", () => {
  const route = readFileSync("app/api/consult/route.ts", "utf8");
  assert.match(route, /getCustomerIdentityResult\(\)/);
  assert.match(
    route,
    /resolveCustomerConsultContext\(\s*customerResult,\s*memberContext/,
  );
  assert.match(route, /ownedMemberContext\?\.concernSlugs/);
  assert.match(route, /ownedMemberContext\?\.productSlugs/);
  assert.doesNotMatch(
    route,
    /const sharedConcernSlugs = \(memberContext|const sharedIngredientIds = \(memberContext/,
  );
  assert.match(route, /Sign in again to use your saved care context\./);
  assert.match(
    route,
    /Your saved care context is unavailable right now\. Try again\./,
  );
  assert.match(
    route,
    /const privateContextResponseHeaders = \{\s*["']Cache-Control["']:\s*["']private, no-store, max-age=0["']/,
  );
  assert.match(
    route,
    /safetyInterruptResponse\(\s*safety,\s*clinical,\s*privateContextResponseInit,?\s*\)/,
  );
  assert.equal(
    (route.match(/responseInit: privateContextResponseInit/g) ?? []).length,
    2,
  );
  assert.equal((route.match(/privateContextResponseInit/g) ?? []).length, 6);
  assert.doesNotMatch(route, /console\.(?:log|error).*memberContext/);
  assert.ok(
    route.indexOf("if (baselineSafety.stopJourney)") <
      route.indexOf("resolveCustomerConsultContext("),
  );
});
