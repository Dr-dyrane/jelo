import 'server-only';

import { listCatalogueProducts } from '@/lib/catalogue/repository';
import {
  queryInventoryRecordPages,
  queryInventoryRecords,
  type InventoryQuery,
} from './inventory-query';

export {
  inventoryCategories,
  inventoryPageSize,
  type InventoryCommunityItem,
  type InventoryAvailabilityFilter,
  type InventoryItem,
  type InventoryPageRangeResult,
  type InventoryPriceFilter,
  type InventoryQuery,
  type InventoryResult,
  type InventoryReviewFilter,
  type InventoryReviewedItem,
  type InventorySort,
} from './inventory-query';

export async function queryInventory(input: InventoryQuery = {}) {
  const reviewedProducts = await listCatalogueProducts();
  return queryInventoryRecords(reviewedProducts, input);
}

export async function queryInventoryPages(
  input: InventoryQuery,
  fromPage: number,
  toPage: number,
) {
  const reviewedProducts = await listCatalogueProducts();
  return queryInventoryRecordPages(reviewedProducts, input, fromPage, toPage);
}
