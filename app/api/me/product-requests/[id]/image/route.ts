import { NextRequest, NextResponse } from 'next/server';
import {
  MAX_CUSTOMER_PRODUCT_REQUEST_IMAGE_BYTES,
} from '@/lib/customer/product-request-image';
import {
  allowedCustomerProductRequestMutation,
  authenticatedProductRequestCustomer,
  customerProductRequestActionResponse,
  readBoundedCustomerProductRequestJson,
} from '@/lib/customer/product-request-api';
import {
  customerProductRequestIdSchema,
  customerProductRequestMutationSchema,
} from '@/lib/customer/product-request-schema';
import { customerProductRequestService } from '@/lib/customer/product-request-service';

type RouteContext = { params: Promise<{ id: string }> };

async function requestId(context: RouteContext) {
  const parsed = customerProductRequestIdSchema.safeParse((await context.params).id);
  return parsed.success ? parsed.data : null;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const id = await requestId(context);
  if (!id) return NextResponse.json({ error: 'Photo not found.' }, { status: 404 });
  const customer = await authenticatedProductRequestCustomer();
  if (!customer) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const image = await customerProductRequestService.readImage(customer, id);
  if (!image?.stream) return NextResponse.json({ error: 'Photo not found.' }, { status: 404 });
  return new Response(image.stream, {
    status: 200,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      'Content-Disposition': 'inline; filename="product-request.webp"',
      'Content-Type': 'image/webp',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Cookie',
    },
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const id = await requestId(context);
  if (!id) return NextResponse.json({ error: 'Product request not found.' }, { status: 404 });
  if (!allowedCustomerProductRequestMutation(request)) {
    return NextResponse.json({ error: 'Request not allowed.' }, { status: 403 });
  }
  const customer = await authenticatedProductRequestCustomer();
  if (!customer) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_CUSTOMER_PRODUCT_REQUEST_IMAGE_BYTES + 128 * 1024) {
    return NextResponse.json({ error: 'Photo must be 4 MB or smaller.' }, { status: 413 });
  }
  try {
    const body = await request.formData();
    const allowedFields = new Set(['image', 'revision', 'idempotencyKey']);
    if (
      [...body.keys()].some(field => !allowedFields.has(field))
      || body.getAll('image').length !== 1
      || body.getAll('revision').length !== 1
      || body.getAll('idempotencyKey').length !== 1
    ) {
      return NextResponse.json({ error: 'Check the photo request and try again.' }, { status: 400 });
    }
    const image = body.get('image');
    if (!(image instanceof File)) {
      return NextResponse.json({ error: 'Choose one photo.' }, { status: 400 });
    }
    const revision = body.get('revision');
    if (typeof revision !== 'string' || !/^(?:0|[1-9][0-9]*)$/.test(revision)) {
      return NextResponse.json({ error: 'Check the request revision and try again.' }, { status: 400 });
    }
    const input = customerProductRequestMutationSchema.parse({
      revision: Number(revision),
      idempotencyKey: body.get('idempotencyKey'),
    });
    return customerProductRequestActionResponse(
      await customerProductRequestService.replaceImage(customer, id, input, image),
    );
  } catch {
    return NextResponse.json({ error: 'Use one JPEG, PNG, or WebP photo up to 4 MB.' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const id = await requestId(context);
  if (!id) return NextResponse.json({ error: 'Product request not found.' }, { status: 404 });
  if (!allowedCustomerProductRequestMutation(request)) {
    return NextResponse.json({ error: 'Request not allowed.' }, { status: 403 });
  }
  const customer = await authenticatedProductRequestCustomer();
  if (!customer) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  try {
    const input = customerProductRequestMutationSchema.parse(
      await readBoundedCustomerProductRequestJson(request),
    );
    return customerProductRequestActionResponse(
      await customerProductRequestService.removeImage(customer, id, input),
    );
  } catch {
    return NextResponse.json({ error: 'Check the request revision and try again.' }, { status: 400 });
  }
}
