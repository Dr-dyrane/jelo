'use server';

import {
  sanitizeInventoryContinuationRequest,
  type InventoryContinuationRequest,
} from '@/lib/catalogue/inventory-continuation';
import { queryInventoryPages } from '@/lib/catalogue/inventory-repository';

export async function loadInventoryContinuation(
  request: InventoryContinuationRequest,
) {
  const safeRequest = sanitizeInventoryContinuationRequest(request);
  return queryInventoryPages(
    safeRequest.query,
    safeRequest.fromPage,
    safeRequest.toPage,
  );
}
