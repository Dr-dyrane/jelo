import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getCustomerIdentity } from './access';
import type { CustomerAccessIdentity } from './access-policy';
import type { CustomerProductRequestActionResult } from './product-request-service';
import { isAllowedCommunityRequest } from '@/lib/community-intake/request-origin';

const MAX_JSON_BYTES = 32 * 1024;

export async function authenticatedProductRequestCustomer(): Promise<CustomerAccessIdentity | null> {
  const identity = await getCustomerIdentity();
  return identity?.source === 'session' ? identity : null;
}

export function allowedCustomerProductRequestMutation(request: NextRequest) {
  return isAllowedCommunityRequest(request.headers, request.nextUrl.origin);
}

export async function readBoundedCustomerProductRequestJson(request: NextRequest) {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
    throw new Error('payload_too_large');
  }
  const source = await request.text();
  if (Buffer.byteLength(source, 'utf8') > MAX_JSON_BYTES) throw new Error('payload_too_large');
  return JSON.parse(source) as unknown;
}

export function customerProductRequestActionResponse(
  result: CustomerProductRequestActionResult,
) {
  switch (result.status) {
    case 'created':
      return NextResponse.json(
        { request: result.request, replayed: result.replayed },
        { status: result.replayed ? 200 : 201, headers: privateCustomerApiHeaders() },
      );
    case 'updated':
      return NextResponse.json(
        { request: result.request, replayed: result.replayed },
        { headers: privateCustomerApiHeaders() },
      );
    case 'withdrawn':
      return NextResponse.json(
        { deleted: true, replayed: result.replayed },
        { headers: privateCustomerApiHeaders() },
      );
    case 'active_catalogue_match':
      return NextResponse.json({
        error: 'That exact product is already in the reviewed catalogue.',
        code: 'ACTIVE_CATALOGUE_MATCH',
        canonicalSlug: result.canonicalSlug,
      }, { status: 409, headers: privateCustomerApiHeaders() });
    case 'revision_conflict':
      return NextResponse.json({
        error: 'Product request changed. Refresh and try again.',
        code: 'REVISION_CONFLICT',
        revision: result.revision,
        lifecycleState: result.lifecycleState,
      }, { status: 409, headers: privateCustomerApiHeaders() });
    case 'state_conflict':
      return NextResponse.json({
        error: 'Product request can no longer be changed.',
        code: 'LIFECYCLE_CONFLICT',
        lifecycleState: result.lifecycleState,
      }, { status: 409, headers: privateCustomerApiHeaders() });
    case 'idempotency_conflict':
      return NextResponse.json({
        error: 'Mutation key was already used for a different change.',
        code: 'IDEMPOTENCY_CONFLICT',
      }, { status: 409, headers: privateCustomerApiHeaders() });
    case 'not_found':
      return NextResponse.json(
        { error: 'Product request not found.' },
        { status: 404, headers: privateCustomerApiHeaders() },
      );
    case 'unavailable':
      return NextResponse.json(
        { error: result.message },
        { status: 503, headers: privateCustomerApiHeaders() },
      );
  }
}

export function privateCustomerApiHeaders() {
  return {
    'Cache-Control': 'private, no-store, max-age=0',
    Vary: 'Cookie',
  };
}
