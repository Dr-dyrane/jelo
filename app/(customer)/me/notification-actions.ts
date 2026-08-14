'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCustomer } from '@/lib/customer/access';
import { markAssistedOrderNotificationRead } from '@/lib/commerce/order-notification-repository';
import { measureCustomerPrivateOperation } from '@/lib/customer/private-telemetry';

const notificationIdSchema = z.uuid();

function refreshNotifications() {
  revalidatePath('/me/notifications');
  revalidatePath('/me', 'layout');
}

export async function markOrderNotificationReadAction(notificationId: unknown) {
  const customer = await requireCustomer('/me/notifications');
  await measureCustomerPrivateOperation({
    surface: 'notifications',
    operation: 'update',
  }, async () => {
    await markAssistedOrderNotificationRead({
      ownerSubject: customer.subject,
      notificationId: notificationIdSchema.parse(notificationId),
    });
    refreshNotifications();
  });
}

export async function markAllOrderNotificationsReadAction() {
  const customer = await requireCustomer('/me/notifications');
  await measureCustomerPrivateOperation({
    surface: 'notifications',
    operation: 'update',
  }, async () => {
    await markAssistedOrderNotificationRead({ ownerSubject: customer.subject });
    refreshNotifications();
  });
}
