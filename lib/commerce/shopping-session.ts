export type ShoppingRetailer = {
  name: string;
  slug: string;
};

export function retailerShoppingSlug(retailerName: string) {
  return retailerName
    .normalize("NFKD")
    .toLocaleLowerCase("en-NG")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function chooseShoppingRetailer(
  retailers: readonly ShoppingRetailer[],
  preferredRetailer: string | null,
  basketHasItems: boolean,
): ShoppingRetailer | null {
  const preferred = retailers.find(
    (retailer) => retailer.name === preferredRetailer,
  );
  if (preferred) return preferred;
  if (basketHasItems) return null;
  return retailers[0] ?? null;
}

export function shoppingRetailerHref(retailer: Pick<ShoppingRetailer, "slug">) {
  const params = new URLSearchParams({ shopping: "1" });
  return `/retailers/${retailer.slug}?${params.toString()}`;
}
