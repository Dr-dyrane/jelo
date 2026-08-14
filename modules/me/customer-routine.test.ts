import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { CustomerAccessIdentity } from "../../lib/customer/access-policy";
import { LEGACY_SHELF_IMPORT_MANIFEST } from "../../lib/customer/legacy-shelf-import-manifest";
import {
  bindCustomerRoutineStepReferences,
  parseCustomerRoutineInput,
  serializeCustomerRoutineSteps,
  type CustomerRoutineInput,
} from "../../lib/customer/routine-input";
import { createCustomerRoutineService } from "../../lib/customer/routine-policy";
import type {
  CustomerRoutineRecord,
  CustomerRoutineRepository,
} from "../../lib/customer/routine-repository";

const identity = (
  subject: string,
  source: CustomerAccessIdentity["source"] = "session",
): CustomerAccessIdentity => ({
  subject,
  email: null,
  emailVerified: true,
  name: null,
  displayName: null,
  preferredFirstName: null,
  source,
});

function memoryRepository() {
  const rows = new Map<string, Map<string, CustomerRoutineRecord>>();
  let sequence = 0;
  const ownerRows = (owner: string) => {
    const existing = rows.get(owner);
    if (existing) return existing;
    const created = new Map<string, CustomerRoutineRecord>();
    rows.set(owner, created);
    return created;
  };
  const toRecord = (
    id: string,
    revision: number,
    input: CustomerRoutineInput,
  ): CustomerRoutineRecord => ({
    id,
    revision,
    name: input.name,
    origin: "customer",
    createdAt: "2026-08-03T12:00:00.000Z",
    updatedAt: "2026-08-03T12:00:00.000Z",
    steps: input.steps.map((step, index) => ({
      id: `${id}:step:${index + 1}`,
      position: index + 1,
      label: step.label,
      instruction: step.instruction,
      referenceState: "none",
      productIdentityVersionId: null,
      productRequestId: null,
      productLifecycleState: null,
      currentProductSlug: null,
      currentProductPublished: false,
    })),
  });
  const repository: CustomerRoutineRepository = {
    async list(owner) {
      return [...ownerRows(owner).values()];
    },
    async summary(owner) {
      const routines = [...ownerRows(owner).values()];
      return {
        routineCount: routines.length,
        stepCount: routines.reduce((total, r) => total + r.steps.length, 0),
      };
    },
    async contextForProduct(owner, slug) {
      return [...ownerRows(owner).values()].filter((routine) =>
        routine.steps.some(
          (step) =>
            step.currentProductSlug === slug || step.referenceState === "none",
        ),
      );
    },
    async create(owner, input) {
      sequence += 1;
      const id = `11111111-1111-4111-8111-${String(sequence).padStart(12, "0")}`;
      ownerRows(owner).set(id, toRecord(id, 0, input));
      return id;
    },
    async update(owner, id, expectedRevision, input) {
      const current = ownerRows(owner).get(id);
      if (!current || current.revision !== expectedRevision) return "conflict";
      ownerRows(owner).set(id, toRecord(id, current.revision + 1, input));
      return "updated";
    },
    async remove(owner, id) {
      return ownerRows(owner).delete(id) ? "removed" : "already_removed";
    },
  };
  return { repository, rows };
}

test("routine inputs normalize bounded line-based steps", () => {
  const parsed = parseCustomerRoutineInput(
    "  Morning  ",
    "Cleanse | Brief, gentle cleanse.\nMoisturize | Light hydration.",
  );
  assert.deepEqual(parsed, {
    name: "Morning",
    stepSourceFormat: "legacy",
    steps: [
      { label: "Cleanse", instruction: "Brief, gentle cleanse." },
      { label: "Moisturize", instruction: "Light hydration." },
    ],
  });
  const serialized = serializeCustomerRoutineSteps(parsed.steps);
  assert.deepEqual(parseCustomerRoutineInput("Morning", serialized), {
    ...parsed,
    stepSourceFormat: "structured",
  });
  assert.throws(() => parseCustomerRoutineInput("", "Cleanse"));
  assert.throws(() => parseCustomerRoutineInput("Routine", ""));
  assert.throws(() =>
    parseCustomerRoutineInput(
      "Routine",
      Array.from({ length: 21 }, () => "Step").join("\n"),
    ),
  );
});

test("structured routine inputs round-trip bounded source step IDs and reject ambiguity", () => {
  const sourceStepId = "11111111-1111-4111-8111-111111111111";
  const serialized = serializeCustomerRoutineSteps([
    { sourceStepId, label: "  Cleanse  ", instruction: "  Gently.  " },
    { label: "Moisturize", instruction: "" },
  ]);
  assert.deepEqual(parseCustomerRoutineInput("Morning", serialized), {
    name: "Morning",
    stepSourceFormat: "structured",
    steps: [
      { sourceStepId, label: "Cleanse", instruction: "Gently." },
      { label: "Moisturize", instruction: "" },
    ],
  });

  assert.throws(() => parseCustomerRoutineInput("Morning", JSON.stringify([
    { sourceStepId, label: "Cleanse", instruction: "" },
    { sourceStepId: sourceStepId.toUpperCase(), label: "Repeat", instruction: "" },
  ])));
  assert.throws(() => parseCustomerRoutineInput("Morning", JSON.stringify([
    { sourceStepId: "not-a-uuid", label: "Cleanse", instruction: "" },
  ])));
  assert.throws(() => parseCustomerRoutineInput("Morning", JSON.stringify([
    { sourceStepId, label: "Cleanse", instruction: "", ownerSubject: "other" },
  ])));
  assert.throws(() => parseCustomerRoutineInput("Morning", "[" + " ".repeat(16_384)));
});

test("authoritative Routine references survive edits while new steps remain unreferenced", () => {
  const catalogueStepId = "11111111-1111-4111-8111-111111111111";
  const requestStepId = "22222222-2222-4222-8222-222222222222";
  const unresolvedStepId = "33333333-3333-4333-8333-333333333333";
  const productIdentityVersionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const productRequestId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const input = parseCustomerRoutineInput("Morning", serializeCustomerRoutineSteps([
    { sourceStepId: requestStepId, label: "Pending product", instruction: "Second" },
    { sourceStepId: catalogueStepId, label: "Exact product", instruction: "First" },
    { sourceStepId: unresolvedStepId, label: "Reviewed text", instruction: "Third" },
    { label: "New plain step", instruction: "Fourth" },
  ]));
  const references = [
    {
      sourceStepId: catalogueStepId,
      referenceState: "catalogue" as const,
      productIdentityVersionId,
      productRequestId: null,
    },
    {
      sourceStepId: requestStepId,
      referenceState: "product_request" as const,
      productIdentityVersionId: null,
      productRequestId,
    },
    {
      sourceStepId: unresolvedStepId,
      referenceState: "unresolved" as const,
      productIdentityVersionId: null,
      productRequestId: null,
    },
  ];

  assert.deepEqual(
    bindCustomerRoutineStepReferences(
      input.steps,
      references,
      input.stepSourceFormat,
    ),
    [
      {
        sourceStepId: requestStepId,
        label: "Pending product",
        instruction: "Second",
        referenceState: "product_request",
        productIdentityVersionId: null,
        productRequestId,
      },
      {
        sourceStepId: catalogueStepId,
        label: "Exact product",
        instruction: "First",
        referenceState: "catalogue",
        productIdentityVersionId,
        productRequestId: null,
      },
      {
        sourceStepId: unresolvedStepId,
        label: "Reviewed text",
        instruction: "Third",
        referenceState: "unresolved",
        productIdentityVersionId: null,
        productRequestId: null,
      },
      {
        label: "New plain step",
        instruction: "Fourth",
        referenceState: "none",
        productIdentityVersionId: null,
        productRequestId: null,
      },
    ],
  );

  const foreignStep = parseCustomerRoutineInput("Morning", serializeCustomerRoutineSteps([
    { sourceStepId: "44444444-4444-4444-8444-444444444444", label: "Foreign", instruction: "" },
  ]));
  assert.equal(
    bindCustomerRoutineStepReferences(
      foreignStep.steps,
      references,
      foreignStep.stepSourceFormat,
    ),
    null,
  );
});

test("legacy Routine updates cannot erase stored references but structured replacement remains explicit", () => {
  const sourceStepId = "11111111-1111-4111-8111-111111111111";
  const references = [{
    sourceStepId,
    referenceState: "catalogue" as const,
    productIdentityVersionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    productRequestId: null,
  }];
  const legacy = parseCustomerRoutineInput("Morning", "Cleanse | Gently.");
  assert.equal(
    bindCustomerRoutineStepReferences(
      legacy.steps,
      references,
      legacy.stepSourceFormat,
    ),
    null,
  );

  const structured = parseCustomerRoutineInput(
    "Morning",
    serializeCustomerRoutineSteps([{ label: "Replacement", instruction: "" }]),
  );
  assert.deepEqual(
    bindCustomerRoutineStepReferences(
      structured.steps,
      references,
      structured.stepSourceFormat,
    ),
    [{
      label: "Replacement",
      instruction: "",
      referenceState: "none",
      productIdentityVersionId: null,
      productRequestId: null,
    }],
  );
});

test("routine create, list, update, and delete remain owner-isolated", async () => {
  const memory = memoryRepository();
  const service = createCustomerRoutineService(memory.repository);
  const ownerA = identity("customer:a");
  const ownerB = identity("customer:b");
  const input = parseCustomerRoutineInput("Morning", "Cleanse | Gently.");

  assert.equal((await service.create(ownerA, input)).status, "created");
  const created = (await service.read(ownerA)).routines[0]!;
  assert.equal((await service.read(ownerB)).routines.length, 0);
  assert.equal(
    (await service.update(ownerB, created.id, 0, input)).status,
    "conflict",
  );
  assert.equal(
    (
      await service.update(ownerA, created.id, 0, {
        name: "Evening",
        steps: [{ label: "Cleanse", instruction: "Remove sunscreen." }],
      })
    ).status,
    "updated",
  );
  assert.equal(
    (await service.update(ownerA, created.id, 0, input)).status,
    "conflict",
  );
  assert.equal(
    (await service.remove(ownerB, created.id)).status,
    "already_removed",
  );
  assert.equal((await service.remove(ownerA, created.id)).status, "removed");
  assert.equal((await service.read(ownerA)).routines.length, 0);
  assert.equal(memory.rows.get(ownerB.subject)?.size ?? 0, 0);
});

test("synthetic and missing identities fail closed", async () => {
  const memory = memoryRepository();
  const service = createCustomerRoutineService(memory.repository);
  const input = parseCustomerRoutineInput("Morning", "Cleanse");
  assert.equal((await service.read(identity(""))).status, "unavailable");
  assert.equal(
    (
      await service.create(
        identity("synthetic", "synthetic-development"),
        input,
      )
    ).status,
    "error",
  );
  assert.equal(memory.rows.size, 0);
});

test("routine migration forces owner RLS and grants only exact runtime CRUD", () => {
  const migration = readFileSync(
    "db/migrations/0037_customer_routines.sql",
    "utf8",
  );
  for (const table of ["customer_routines", "customer_routine_steps"]) {
    assert.match(
      migration,
      new RegExp(`alter table ${table} enable row level security`),
    );
    assert.match(
      migration,
      new RegExp(`alter table ${table} force row level security`),
    );
    assert.match(
      migration,
      new RegExp(
        `revoke all privileges on table public\\.${table} from public`,
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `revoke all privileges on table public\\.${table} from jelocare_app_runtime`,
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `grant select, insert, update, delete on table public\\.${table} to jelocare_shelf_runtime`,
      ),
    );
  }
  assert.equal(
    migration.match(/current_setting\('app\.customer_subject', true\)/g)
      ?.length,
    4,
  );
  assert.match(migration, /foreign key \(owner_subject, routine_id\)/);
  assert.match(migration, /foreign key \(owner_subject, product_request_id\)/);
  assert.match(migration, /routine_count integer not null default 0/);
  assert.match(migration, /routine_step_count integer not null default 0/);
  assert.doesNotMatch(migration, /alter default privileges/i);
});

test("the pinned legacy routine manifest contains exactly three routines and eleven ordered steps", () => {
  assert.equal(LEGACY_SHELF_IMPORT_MANIFEST.routines.length, 3);
  assert.deepEqual(
    LEGACY_SHELF_IMPORT_MANIFEST.routines.map((routine) => routine.name),
    ["Morning", "Evening", "Hair wash"],
  );
  assert.equal(
    LEGACY_SHELF_IMPORT_MANIFEST.routines.flatMap((routine) => routine.steps)
      .length,
    11,
  );
  assert.deepEqual(
    LEGACY_SHELF_IMPORT_MANIFEST.routines[0]?.steps.map((step) => [
      step.position,
      step.label,
      step.instruction,
    ]),
    [
      [1, "COSRX cleanser", "Brief, gentle cleanse."],
      [2, "Anua serum", "Thin, even layer."],
      [3, "Wonder Cream", "Light hydration."],
      [4, "B.LAB sunscreen", "Final morning step."],
    ],
  );
  const unresolved = LEGACY_SHELF_IMPORT_MANIFEST.routines
    .flatMap((routine) => routine.steps)
    .filter((step) => step.reference.state === "unresolved");
  assert.deepEqual(
    unresolved.map((step) => step.label),
    ["Cleanse", "Treat", "Moisturize", "Kuza + OGX"],
  );
});

test("routine actions derive the owner and the importer commits receipt counts atomically", () => {
  const actions = readFileSync("app/(customer)/me/actions.ts", "utf8");
  const importer = readFileSync("scripts/import-customer-shelf.ts", "utf8");
  for (const action of [
    "createRoutineAction",
    "updateRoutineAction",
    "deleteRoutineAction",
  ]) {
    assert.match(actions, new RegExp(`export async function ${action}`));
  }
  assert.match(actions, /requireCustomer\(['"]\/me\/routine['"]\)/g);
  assert.doesNotMatch(actions, /formData\.get\(['"]owner/);
  assert.match(
    importer,
    /lock table public\.customer_routines in share row exclusive mode/,
  );
  assert.match(
    importer,
    /lock table public\.customer_routine_steps in share row exclusive mode/,
  );
  assert.match(importer, /hasExactSet\(routineIds, routineFinal\)/);
  assert.match(importer, /hasExactSet\(routineStepIds, routineStepFinal\)/);
  assert.match(importer, /routine_count = excluded\.routine_count/);
  assert.match(importer, /routine_step_count = excluded\.routine_step_count/);
  assert.doesNotMatch(
    importer,
    /console\.(?:log|error)\([^\n]*(?:ownerSubject|routineId|stepId)/,
  );
});

test("Routine edits bind source steps inside the exact owner transaction before rewriting", () => {
  const actions = readFileSync("app/(customer)/me/actions.ts", "utf8");
  const sheet = readFileSync("components/me/routine/routine-sheet.tsx", "utf8");
  const repository = readFileSync("lib/customer/routine-repository.ts", "utf8");

  assert.match(sheet, /sourceStepId: step\.id/);
  assert.match(sheet, /step\.sourceStepId \? \{ sourceStepId: step\.sourceStepId \}/);
  assert.match(sheet, /\.filter\(step => step\.sourceStepId \|\| step\.label\.trim\(\)\)/);
  assert.match(actions, /formData\.get\(["']steps["']\)/);
  assert.match(
    repository,
    /select id[\s\S]*where owner_subject = \$\{owner\}[\s\S]*and id = \$\{id\}[\s\S]*and revision = \$\{revision\}[\s\S]*for update/,
  );
  assert.match(
    repository,
    /step\.id as source_step_id[\s\S]*step\.owner_subject = \$\{owner\}[\s\S]*step\.routine_id = \$\{id\}[\s\S]*for update/,
  );
  assert.match(repository, /if \(!steps\) return ['"]conflict['"]/);
  assert.match(repository, /\$\{step\.referenceState\}/);
  assert.match(repository, /\$\{step\.productIdentityVersionId\}/);
  assert.match(repository, /\$\{step\.productRequestId\}/);
  assert.doesNotMatch(repository, /\$\{step\.instruction\},\s*['"]none['"]/);

  const routineLock = repository.indexOf("select id\n        from public.customer_routines");
  const referenceLock = repository.indexOf("step.id as source_step_id");
  const routineUpdate = repository.indexOf("update public.customer_routines");
  const stepDelete = repository.indexOf("delete from public.customer_routine_steps");
  assert.ok(routineLock !== -1 && routineLock < referenceLock);
  assert.ok(referenceLock < routineUpdate);
  assert.ok(routineUpdate < stepDelete);
});
