import "server-only";

import { randomUUID } from "node:crypto";
import {
  assertCustomerShelfRlsRole,
  getCustomerShelfPostgresClient,
} from "./shelf-database";
import { isValidCustomerShelfOwnerSubject } from "./shelf-policy";
import type {
  SavedCustomerLocation,
  SavedCustomerLocationKind,
} from "@/lib/location/model";
import type { SavedCustomerLocationInput } from "@/lib/location/schema";

const MAX_SAVED_LOCATIONS = 8;

type SavedLocationRow = {
  id: string;
  label: string;
  kind: SavedCustomerLocationKind;
  address_line: string;
  city: string;
  state: string;
  postal_code: string | null;
  is_default: boolean;
  revision: number;
  updated_at: string | Date;
};

function ownerSubject(value: string) {
  const owner = value.trim();
  if (!isValidCustomerShelfOwnerSubject(owner))
    throw new Error("saved_location_owner_unavailable");
  return owner;
}

function mapRow(row: SavedLocationRow): SavedCustomerLocation {
  return {
    id: row.id,
    label: row.label,
    kind: row.kind,
    address: row.address_line,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code ?? "",
    isDefault: row.is_default,
    revision: row.revision,
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

async function withOwner<T>(
  owner: string,
  operation: (
    transaction: ReturnType<typeof getCustomerShelfPostgresClient>,
  ) => Promise<T>,
) {
  const sql = getCustomerShelfPostgresClient();
  return sql.begin(async (transaction) => {
    await transaction`select pg_catalog.set_config('search_path', 'pg_catalog, public', true)`;
    await assertCustomerShelfRlsRole(transaction);
    await transaction`select pg_catalog.set_config('app.customer_subject', ${owner}, true)`;
    return operation(transaction);
  });
}

export type CustomerLocationRepository = {
  list(owner: string): Promise<SavedCustomerLocation[]>;
  create(
    owner: string,
    input: SavedCustomerLocationInput,
  ): Promise<SavedCustomerLocation>;
  update(
    owner: string,
    input: SavedCustomerLocationInput & { id: string; revision: number },
  ): Promise<SavedCustomerLocation | null>;
  remove(owner: string, id: string, revision: number): Promise<boolean>;
};

export const postgresCustomerLocationRepository: CustomerLocationRepository = {
  async list(value) {
    const owner = ownerSubject(value);
    return withOwner(owner, async (transaction) => {
      const rows = await transaction<SavedLocationRow[]>`
        select id, label, kind, address_line, city, state, postal_code,
               is_default, revision, updated_at
        from public.customer_saved_locations
        where owner_subject = ${owner}
        order by is_default desc, updated_at desc, id
      `;
      return rows.map(mapRow);
    });
  },

  async create(value, input) {
    const owner = ownerSubject(value);
    return withOwner(owner, async (transaction) => {
      await transaction`select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(${owner}))`;
      const [count] = await transaction<{ count: number }[]>`
        select pg_catalog.count(*)::integer as count
        from public.customer_saved_locations
        where owner_subject = ${owner}
      `;
      if ((count?.count ?? MAX_SAVED_LOCATIONS) >= MAX_SAVED_LOCATIONS) {
        throw new Error("saved_location_limit");
      }
      if (input.isDefault) {
        await transaction`
          update public.customer_saved_locations
          set is_default = false, revision = revision + 1, updated_at = now()
          where owner_subject = ${owner} and kind = ${input.kind} and is_default
        `;
      }
      const id = randomUUID();
      const [row] = await transaction<SavedLocationRow[]>`
        insert into public.customer_saved_locations (
          id, owner_subject, kind, label, address_line, city, state, postal_code, is_default
        ) values (
          ${id}, ${owner}, ${input.kind}, ${input.label}, ${input.address}, ${input.city},
          ${input.state}, ${input.postalCode || null}, ${input.isDefault}
        )
        returning id, label, kind, address_line, city, state, postal_code,
                  is_default, revision, updated_at
      `;
      if (!row) throw new Error("saved_location_create_failed");
      return mapRow(row);
    });
  },

  async update(value, input) {
    const owner = ownerSubject(value);
    return withOwner(owner, async (transaction) => {
      await transaction`select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(${owner}))`;
      if (input.isDefault) {
        await transaction`
          update public.customer_saved_locations
          set is_default = false, revision = revision + 1, updated_at = now()
          where owner_subject = ${owner} and kind = ${input.kind} and is_default and id <> ${input.id}
        `;
      }
      const [row] = await transaction<SavedLocationRow[]>`
        update public.customer_saved_locations
        set kind = ${input.kind}, label = ${input.label}, address_line = ${input.address},
            city = ${input.city}, state = ${input.state}, postal_code = ${input.postalCode || null},
            is_default = ${input.isDefault}, revision = revision + 1, updated_at = now()
        where owner_subject = ${owner} and id = ${input.id} and revision = ${input.revision}
        returning id, label, kind, address_line, city, state, postal_code,
                  is_default, revision, updated_at
      `;
      return row ? mapRow(row) : null;
    });
  },

  async remove(value, id, revision) {
    const owner = ownerSubject(value);
    return withOwner(owner, async (transaction) => {
      const rows = await transaction<{ id: string }[]>`
        delete from public.customer_saved_locations
        where owner_subject = ${owner} and id = ${id} and revision = ${revision}
        returning id
      `;
      return rows.length === 1;
    });
  },
};
