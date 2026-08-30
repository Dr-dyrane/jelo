import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { buildBasketPreview } from "../../lib/commerce/basket-preview";

const root = process.cwd();

test("basket preview keeps product identity and per-product quantities", () => {
  const preview = buildBasketPreview(
    [
      { slug: "cleanser", quantity: 2 },
      { slug: "serum", quantity: 1 },
    ],
    [
      {
        slug: "cleanser",
        brand: "Jelo",
        name: "Cleanser",
        image: "/cleanser.png",
      },
      {
        slug: "serum",
        brand: "Care",
        name: "Serum",
        image: "/serum.png",
      },
    ],
  );

  assert.deepEqual(preview, [
    {
      slug: "cleanser",
      brand: "Jelo",
      name: "Cleanser",
      image: "/cleanser.png",
      quantity: 2,
    },
    {
      slug: "serum",
      brand: "Care",
      name: "Serum",
      image: "/serum.png",
      quantity: 1,
    },
  ]);
});

test("public basket action stays visible on content pages and leaves basket flows clear", async () => {
  const component = await readFile(
    path.join(root, "components/commerce/public-basket-pill.tsx"),
    "utf8",
  );
  const styles = await readFile(
    path.join(root, "components/commerce/public-basket-pill.module.css"),
    "utf8",
  );
  const layout = await readFile(
    path.join(root, "app/(site)/layout.tsx"),
    "utf8",
  );

  assert.match(component, /href="\/basket"/);
  assert.match(component, /basket\.totalQuantity === 0/);
  assert.match(component, /"\/basket", "\/checkout", "\/order", "\/sign-in"/);
  assert.match(
    component,
    /segments\.length === 2 && segments\[0\] === ["']products["']/,
  );
  assert.match(component, /isProductDetail\(pathname\)/);
  assert.match(component, /product\.quantity/);
  assert.match(
    component,
    /Basket full\. Your basket holds up to \$\{BASKET_MAX_PRODUCTS\} products/,
  );
  assert.match(
    component,
    /role=\{productLimitReached \? "status" : undefined\}/,
  );
  assert.match(component, /SafeProductImage/);
  assert.match(styles, /position:\s*fixed/);
  assert.match(styles, /bottom:\s*var\(--site-chrome-safe-bottom\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(layout, /<PublicBasketPill products=\{basketProducts\} \/>/);
});
