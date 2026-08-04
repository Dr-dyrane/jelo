import { NextRequest, NextResponse } from 'next/server';
import {
  allowedCustomerProductRequestMutation,
  authenticatedProductRequestCustomer,
  customerProductRequestActionResponse,
  privateCustomerApiHeaders,
  readBoundedCustomerProductRequestJson,
} from '@/lib/customer/product-request-api';
import { createCustomerProductRequestSchema } from '@/lib/customer/product-request-schema';
import { customerProductRequestService } from '@/lib/customer/product-request-service';

export async function GET() {
  const customer = await authenticatedProductRequestCustomer();
  if (!customer) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const result = await customerProductRequestService.list(customer);
  if (result.status !== 'ready') {
    return NextResponse.json({ error: result.message }, {
      status: 503,
      headers: privateCustomerApiHeaders(),
    });
  }
  return NextResponse.json({ requests: result.requests }, {
    headers: privateCustomerApiHeaders(),
  });
}

export async function POST(request: NextRequest) {
  if (!allowedCustomerProductRequestMutation(request)) {
    return NextResponse.json({ error: 'Request not allowed.' }, { status: 403 });
  }
  const customer = await authenticatedProductRequestCustomer();
  if (!customer) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  try {
    const input = createCustomerProductRequestSchema.parse(
      await readBoundedCustomerProductRequestJson(request),
    );
    return customerProductRequestActionResponse(
      await customerProductRequestService.create(customer, input),
    );
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error && error.message === 'payload_too_large'
        ? 'Product request is too large.'
        : 'Check the product details and try again.',
    }, { status: 400 });
  }
}
