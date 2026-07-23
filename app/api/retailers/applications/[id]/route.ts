import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  readRetailerPartnershipApplication,
  saveRetailerPartnershipApplication,
} from '@/lib/retailer-partnership/repository';
import { saveRetailerPartnershipSchema } from '@/lib/retailer-partnership/schema';
import {
  allowRetailerPartnershipAction,
  hashEditSecret,
  readBoundedJson,
  retailerPartnershipSecretFromRequest,
  sameSiteRequest,
} from '@/lib/retailer-partnership/security';

export const runtime = 'nodejs';
const idSchema = z.uuid();

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
  const secret = retailerPartnershipSecretFromRequest(request, id);
  if (!secret) return NextResponse.json({ error: 'Private link required.' }, { status: 401 });
  const application = await readRetailerPartnershipApplication(id, hashEditSecret(secret));
  if (!application) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
  return NextResponse.json({
    applicationId: application.id,
    revision: application.revision,
    status: application.status,
    draft: application.payload,
    emailVerified: Boolean(application.email_verified_at),
    expiresAt: application.magic_link_expires_at.toISOString(),
  });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
  if (!sameSiteRequest(request)) return NextResponse.json({ error: 'Request not allowed.' }, { status: 403 });
  if (!await allowRetailerPartnershipAction(request, 'save', id)) {
    return NextResponse.json({ error: 'Saving too quickly.' }, { status: 429 });
  }
  const secret = retailerPartnershipSecretFromRequest(request, id);
  if (!secret) return NextResponse.json({ error: 'Private link required.' }, { status: 401 });

  try {
    const input = saveRetailerPartnershipSchema.parse(await readBoundedJson(request));
    const result = await saveRetailerPartnershipApplication({
      id,
      editSecretHash: hashEditSecret(secret),
      revision: input.revision,
      draft: input.draft,
    });
    if (!result.ok && result.reason === 'revision') {
      return NextResponse.json({ error: 'Application changed.', revision: result.revision }, { status: 409 });
    }
    if (!result.ok) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
    return NextResponse.json({ revision: result.revision, savedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error && error.message === 'payload_too_large'
      ? 'That is too much information for one request.'
      : 'Check the details and try again.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
