import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { saveCommunityDraft } from '@/lib/community-intake/repository';
import { saveDraftRequestSchema } from '@/lib/community-intake/schema';
import {
  allowCommunityAction,
  editSecretFromRequest,
  hashEditSecret,
  readBoundedJson,
  sameSiteRequest,
} from '@/lib/community-intake/security';

const idSchema = z.uuid();

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: 'Draft not found.' }, { status: 404 });
  if (!sameSiteRequest(request)) return NextResponse.json({ error: 'Request not allowed.' }, { status: 403 });
  if (!await allowCommunityAction(request, 'save', id)) return NextResponse.json({ error: 'Saving too quickly.' }, { status: 429 });
  const secret = editSecretFromRequest(request, id);
  if (!secret) return NextResponse.json({ error: 'Draft access expired.' }, { status: 401 });

  try {
    const input = saveDraftRequestSchema.parse(await readBoundedJson(request));
    const result = await saveCommunityDraft({
      id,
      editSecretHash: hashEditSecret(secret),
      revision: input.revision,
      draft: input.draft,
      events: input.events,
    });
    if (!result.ok && result.reason === 'revision') {
      return NextResponse.json({ error: 'Draft changed.', revision: result.revision }, { status: 409 });
    }
    if (!result.ok) return NextResponse.json({ error: 'Draft not found.' }, { status: 404 });
    return NextResponse.json({ revision: result.revision, savedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error && error.message === 'payload_too_large'
      ? 'Contribution is too large.'
      : 'Check the contribution and try again.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
