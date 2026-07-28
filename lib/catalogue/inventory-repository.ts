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
  return (await loadInventory(input)).result;
}

/**
 * Loads the published catalogue once for pages that need both the inventory
 * projection and the reviewed records used to build factual discovery scopes.
 */
export async function loadInventory(input: InventoryQuery = {}) {
  const reviewedProducts = await listCatalogueProducts();
  return {
    result: queryInventoryRecords(reviewedProducts, input),
    reviewedProducts,
  };
}

export async function queryInventoryPages(
  input: InventoryQuery,
  fromPage: number,
  toPage: number,
) {
  const reviewedProducts = await listCatalogueProducts();
  return queryInventoryRecordPages(reviewedProducts, input, fromPage, toPage);
}
