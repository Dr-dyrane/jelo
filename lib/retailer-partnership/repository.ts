import 'server-only';

import { getPostgresClient } from '@/lib/db/postgres';
import type { RetailerPartnershipDraft } from './schema';

type ApplicationRow = {
  id: string;
  revision: number;
  status: 'draft' | 'submitted' | 'approved' | 'declined' | 'expired';
  payload: RetailerPartnershipDraft;
  email: string;
  email_verified_at: Date | null;
  magic_link_expires_at: Date;
};

export async function createRetailerPartnershipApplication(
  draft: RetailerPartnershipDraft,
  editSecretHash: string,
) {
  const sql = getPostgresClient();
  return sql.begin(async transaction => {
    const [application] = await transaction<ApplicationRow[]>`
      insert into retailer_partnership_applications (
        edit_secret_hash, store_name, email, email_normalized,
        contact_consent_at, payload, current_step
      ) values (
        ${editSecretHash}, ${draft.storeName}, ${draft.email}, ${draft.email},
        now(), ${transaction.json(draft)}, ${draft.currentStep}
      )
      returning id, revision, status, payload, email, email_verified_at, magic_link_expires_at
    `;
    await transaction`
      insert into retailer_partnership_events (application_id, event_type)
      values (${application.id}, 'application_created')
    `;
    return application;
  });
}

export async function recordRetailerMagicLinkSent(applicationId: string) {
  const sql = getPostgresClient();
  await sql.begin(async transaction => {
    await transaction`
      update retailer_partnership_applications
      set magic_link_sent_at = now(), updated_at = now()
      where id = ${applicationId}
    `;
    await transaction`
      insert into retailer_partnership_events (application_id, event_type)
      values (${applicationId}, 'magic_link_sent')
    `;
  });
}

export async function readRetailerPartnershipApplication(applicationId: string, editSecretHash: string) {
  const sql = getPostgresClient();
  const [row] = await sql<ApplicationRow[]>`
    select id, revision, status, payload, email, email_verified_at, magic_link_expires_at
    from retailer_partnership_applications
    where id = ${applicationId}
      and edit_secret_hash = ${editSecretHash}
      and retain_until > now()
    limit 1
  `;
  return row ?? null;
}

export async function saveRetailerPartnershipApplication(input: {
  id: string;
  editSecretHash: string;
  revision: number;
  draft: RetailerPartnershipDraft;
}) {
  const sql = getPostgresClient();
  return sql.begin(async transaction => {
    const [updated] = await transaction<ApplicationRow[]>`
      update retailer_partnership_applications
      set store_name = ${input.draft.storeName},
          payload = ${transaction.json(input.draft)},
          current_step = ${input.draft.currentStep},
          revision = revision + 1,
          updated_at = now()
      where id = ${input.id}
        and edit_secret_hash = ${input.editSecretHash}
        and status = 'draft'
        and revision = ${input.revision}
      returning id, revision, status, payload, email, email_verified_at, magic_link_expires_at
    `;
    if (!updated) {
      const [current] = await transaction<Pick<ApplicationRow, 'revision' | 'status'>[]>`
        select revision, status
        from retailer_partnership_applications
        where id = ${input.id} and edit_secret_hash = ${input.editSecretHash}
      `;
      return current
        ? { ok: false as const, reason: 'revision' as const, revision: current.revision, status: current.status }
        : { ok: false as const, reason: 'missing' as const };
    }
    await transaction`
      insert into retailer_partnership_events (application_id, event_type)
      values (${input.id}, 'draft_saved')
    `;
    return { ok: true as const, revision: updated.revision };
  });
}

export async function openRetailerPartnershipMagicLink(applicationId: string, editSecretHash: string) {
  const sql = getPostgresClient();
  return sql.begin(async transaction => {
    const [application] = await transaction<ApplicationRow[]>`
      update retailer_partnership_applications
      set email_verified_at = coalesce(email_verified_at, now()), updated_at = now()
      where id = ${applicationId}
        and edit_secret_hash = ${editSecretHash}
        and status = 'draft'
        and magic_link_expires_at > now()
      returning id, revision, status, payload, email, email_verified_at, magic_link_expires_at
    `;
    if (!application) return null;
    await transaction`
      insert into retailer_partnership_events (application_id, event_type)
      values (${applicationId}, 'magic_link_opened')
    `;
    return application;
  });
}

export async function submitRetailerPartnershipApplication(
  applicationId: string,
  editSecretHash: string,
  draft: RetailerPartnershipDraft,
) {
  const sql = getPostgresClient();
  return sql.begin(async transaction => {
    const [application] = await transaction<{ id: string }[]>`
      update retailer_partnership_applications
      set store_name = ${draft.storeName},
          payload = ${transaction.json(draft)},
          current_step = 8,
          revision = revision + 1,
          status = 'submitted',
          submitted_at = now(),
          updated_at = now()
      where id = ${applicationId}
        and edit_secret_hash = ${editSecretHash}
        and status = 'draft'
      returning id
    `;
    if (!application) return null;
    await transaction`
      insert into retailer_partnership_events (application_id, event_type)
      values (${applicationId}, 'application_submitted')
    `;
    return application;
  });
}
