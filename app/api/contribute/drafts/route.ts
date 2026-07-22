import { NextRequest, NextResponse } from 'next/server';
import { hasPostgresConfig } from '@/lib/db/postgres';
import { createCommunityDraft } from '@/lib/community-intake/repository';
import { createDraftRequestSchema } from '@/lib/community-intake/schema';
import {
  allowCommunityAction,
  contributionCookieMaxAge,
  contributionCookieName,
  contributionCookieValue,
  createEditSecret,
  hashEditSecret,
  readBoundedJson,
  sameSiteRequest,
} from '@/lib/community-intake/security';

export async function POST(request: NextRequest) {
  if (!sameSiteRequest(request)) return NextResponse.json({ error: 'Request not allowed.' }, { status: 403 });
  if (!await allowCommunityAction(request, 'create')) return NextResponse.json({ error: 'Please try again later.' }, { status: 429 });
  if (!hasPostgresConfig()) return NextResponse.json({ error: 'Saving is temporarily unavailable.' }, { status: 503 });

  try {
    const input = createDraftRequestSchema.parse(await readBoundedJson(request));
    const secret = createEditSecret();
    const draft = await createCommunityDraft(input.kind, hashEditSecret(secret));
    const response = NextResponse.json({
      draftId: draft.id,
      revision: draft.revision,
      expiresAt: draft.expires_at.toISOString(),
    }, { status: 201 });
    response.cookies.set({
      name: contributionCookieName,
      value: contributionCookieValue(draft.id, secret),
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/contribute',
      maxAge: contributionCookieMaxAge,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error && error.message === 'payload_too_large'
      ? 'Contribution is too large.'
      : 'Check the contribution and try again.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
