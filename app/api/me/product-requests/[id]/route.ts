import { NextRequest, NextResponse } from 'next/server';
import {
  allowedCustomerProductRequestMutation,
  authenticatedProductRequestCustomer,
  customerProductRequestActionResponse,
  privateCustomerApiHeaders,
  readBoundedCustomerProductRequestJson,
} from '@/lib/customer/product-request-api';
import {
  customerProductRequestIdSchema,
  customerProductRequestMutationSchema,
  updateCustomerProductRequestSchema,
} from '@/lib/customer/product-request-schema';
import { customerProductRequestService } from '@/lib/customer/product-request-service';
import { measureCustomerPrivateResponseOperation } from '@/lib/customer/private-telemetry';

type RouteContext = { params: Promise<{ id: string }> };

async function requestId(context: RouteContext) {
  const parsed = customerProductRequestIdSchema.safeParse((await context.params).id);
  return parsed.success ? parsed.data : null;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const id = await requestId(context);
  if (!id) return NextResponse.json({ error: 'Product request not found.' }, { status: 404 });
  const customer = await authenticatedProductRequestCustomer();
  if (!customer) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  return measureCustomerPrivateResponseOperation(
    { surface: 'product_requests', operation: 'read' },
    async () => {
      const result = await customerProductRequestService.get(customer, id);
      if (result.status === 'not_found') {
        return NextResponse.json({ error: result.message }, { status: 404 });
      }
      if (result.status === 'unavailable') {
        return NextResponse.json({ error: result.message }, { status: 503 });
      }
      return NextResponse.json({ request: result.request }, {
        headers: privateCustomerApiHeaders(),
      });
    },
  );
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const id = await requestId(context);
  if (!id) return NextResponse.json({ error: 'Product request not found.' }, { status: 404 });
  if (!allowedCustomerProductRequestMutation(request)) {
    return NextResponse.json({ error: 'Request not allowed.' }, { status: 403 });
  }
  const customer = await authenticatedProductRequestCustomer();
  if (!customer) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  return measureCustomerPrivateResponseOperation(
    { surface: 'product_requests', operation: 'update' },
    async () => {
      try {
        const input = updateCustomerProductRequestSchema.parse(
          await readBoundedCustomerProductRequestJson(request),
        );
        return customerProductRequestActionResponse(
          await customerProductRequestService.update(customer, id, input),
        );
      } catch (error) {
        return NextResponse.json({
          error: error instanceof Error && error.message === 'payload_too_large'
            ? 'Product request is too large.'
            : 'Check the product details and try again.',
        }, { status: 400 });
      }
    },
  );
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const id = await requestId(context);
  if (!id) return NextResponse.json({ error: 'Product request not found.' }, { status: 404 });
  if (!allowedCustomerProductRequestMutation(request)) {
    return NextResponse.json({ error: 'Request not allowed.' }, { status: 403 });
  }
  const customer = await authenticatedProductRequestCustomer();
  if (!customer) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  return measureCustomerPrivateResponseOperation(
    { surface: 'product_requests', operation: 'delete' },
    async () => {
      try {
        const input = customerProductRequestMutationSchema.parse(
          await readBoundedCustomerProductRequestJson(request),
        );
        return customerProductRequestActionResponse(
          await customerProductRequestService.withdraw(customer, id, input),
        );
      } catch (error) {
        return NextResponse.json({
          error: error instanceof Error && error.message === 'payload_too_large'
            ? 'Product request is too large.'
            : 'Check the request revision and try again.',
        }, { status: 400 });
      }
    },
  );
}
