import { NextResponse } from 'next/server';
import { getCustomerIdentity } from '@/lib/customer/access';
import { countUnreadAssistedOrderNotifications } from '@/lib/commerce/order-notification-repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const customer = await getCustomerIdentity();
  if (!customer) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const unreadCount = await countUnreadAssistedOrderNotifications(customer.subject);
  const response = NextResponse.json({ unreadCount });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
