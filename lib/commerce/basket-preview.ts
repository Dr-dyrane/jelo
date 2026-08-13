import type { BasketItem } from "@/lib/commerce/basket";

export type BasketPreviewProduct = {
  slug: string;
  brand: string;
  name: string;
  image: string;
};

export type BasketPreviewItem = BasketPreviewProduct & {
  quantity: number;
};

export function buildBasketPreview(
  items: readonly BasketItem[],
  products: readonly BasketPreviewProduct[],
): BasketPreviewItem[] {
  const productBySlug = new Map(
    products.map((product) => [product.slug, product]),
  );

  return items.map((item) => {
    const product = productBySlug.get(item.slug);
    return {
      slug: item.slug,
      brand: product?.brand ?? "JeloCare",
      name: product?.name ?? "Product",
      image: product?.image ?? "/product-placeholder.svg",
      quantity: item.quantity,
    };
  });
}
