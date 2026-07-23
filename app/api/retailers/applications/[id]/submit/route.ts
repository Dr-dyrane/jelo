import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  readRetailerPartnershipApplication,
  submitRetailerPartnershipApplication,
} from '@/lib/retailer-partnership/repository';
import { retailerPartnershipDraftSchema } from '@/lib/retailer-partnership/schema';
import {
  allowRetailerPartnershipAction,
  hashEditSecret,
  readBoundedJson,
  retailerPartnershipSecretFromRequest,
  sameSiteRequest,
} from '@/lib/retailer-partnership/security';

export const runtime = 'nodejs';
const idSchema = z.uuid();
const requestSchema = z.object({ draft: retailerPartnershipDraftSchema }).strict();

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
  if (!sameSiteRequest(request)) return NextResponse.json({ error: 'Request not allowed.' }, { status: 403 });
  if (!z.uuid().safeParse(request.headers.get('idempotency-key')).success) {
    return NextResponse.json({ error: 'Submission key missing.' }, { status: 400 });
  }
  if (!await allowRetailerPartnershipAction(request, 'submit', id)) {
    return NextResponse.json({ error: 'Please try again later.' }, { status: 429 });
  }
  const secret = retailerPartnershipSecretFromRequest(request, id);
  if (!secret) return NextResponse.json({ error: 'Private link required.' }, { status: 401 });

  try {
    const input = requestSchema.parse(await readBoundedJson(request));
    const current = await readRetailerPartnershipApplication(id, hashEditSecret(secret));
    if (!current) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
    if (current.status === 'submitted') {
      return NextResponse.json({ applicationId: id, status: 'received', duplicate: true });
    }
    const submitted = await submitRetailerPartnershipApplication(id, hashEditSecret(secret), input.draft);
    if (!submitted) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
    return NextResponse.json({ applicationId: submitted.id, status: 'received', duplicate: false });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'A few details are still missing.',
        fields: error.issues.map(issue => issue.path[0]),
      }, { status: 422 });
    }
    return NextResponse.json({ error: 'Could not share the store yet.' }, { status: 500 });
  }
}
