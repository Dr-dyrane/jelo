import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductSizeSelector } from "@/components/products/product-size-selector";
import { products } from "@/data/catalogue";
import {
  catalogueProductFamilies,
  type CatalogueProductFamily,
} from "@/data/product-families";
import publicCatalogueSearchArtifact from "@/data/public-catalogue-search.json";
import { resolveCatalogueProductFamily } from "@/lib/catalogue/product-family";

const loccitane250Slug = "loccitane-almond-softening-shower-oil-250ml";

test("the L’Occitane family admits only the released exact 250 mL bottle", () => {
  const family = catalogueProductFamilies.find(
    (record) => record.id === "loccitane-almond-shower-oil",
  );
  assert.ok(family);
  assert.deepEqual(family.members, [
    {
      productSlug: loccitane250Slug,
      packageForm: "bottle",
    },
  ]);

  const product = products.find((record) => record.slug === loccitane250Slug);
  const searchRecord = publicCatalogueSearchArtifact.products.find(
    (record) => record.slug === loccitane250Slug,
  );
  assert.ok(product && searchRecord);
  assert.equal(product.size, "250 ml");
  assert.equal(searchRecord.approvedGtin, "3253581785706");
  assert.match(product.image, /loccitane-almond-softening-shower-oil-250ml/);
  assert.equal(
    family.members.some((member) => member.productSlug.includes("500ml")),
    false,
  );
});

test("family resolution preserves independent SKU routes, images, offers and package forms", () => {
  const exactProducts = [
    {
      slug: "almond-250",
      size: "250 ml",
      image: "/250.png",
      offers: [{ id: "offer-250" }],
    },
    {
      slug: "almond-500",
      size: "500 ml",
      image: "/500.png",
      offers: [{ id: "offer-500" }],
    },
    {
      slug: "almond-refill-500",
      size: "500 ml",
      image: "/refill.png",
      offers: [{ id: "offer-refill" }],
    },
  ];
  const families: readonly CatalogueProductFamily[] = [
    {
      id: "almond-shower-oil",
      members: [
        { productSlug: "almond-250", packageForm: "bottle" },
        { productSlug: "almond-500", packageForm: "bottle" },
        { productSlug: "almond-refill-500", packageForm: "refill" },
      ],
    },
  ];

  const resolved = resolveCatalogueProductFamily(
    "almond-500",
    exactProducts,
    families,
  );
  assert.ok(resolved);
  assert.deepEqual(
    resolved.members.map((member) => ({
      slug: member.product.slug,
      image: member.product.image,
      offerId: (member.product.offers[0] as { id: string }).id,
      packageForm: member.packageForm,
      optionLabel: member.optionLabel,
    })),
    [
      {
        slug: "almond-250",
        image: "/250.png",
        offerId: "offer-250",
        packageForm: "bottle",
        optionLabel: "250 mL",
      },
      {
        slug: "almond-500",
        image: "/500.png",
        offerId: "offer-500",
        packageForm: "bottle",
        optionLabel: "500 mL bottle",
      },
      {
        slug: "almond-refill-500",
        image: "/refill.png",
        offerId: "offer-refill",
        packageForm: "refill",
        optionLabel: "500 mL refill",
      },
    ],
  );
  assert.equal(
    new Set(resolved.members.map((member) => member.product.slug)).size,
    3,
  );
  assert.equal(
    new Set(resolved.members.map((member) => member.optionLabel)).size,
    3,
  );
});

test("the selector routes to each exact public member and selects only the current route", () => {
  const exactProducts = [
    { slug: "almond-250", size: "250 ml", image: "/250.png", offers: [] },
    { slug: "almond-500", size: "500 ml", image: "/500.png", offers: [] },
  ];
  const families: readonly CatalogueProductFamily[] = [
    {
      id: "almond-shower-oil",
      members: [
        { productSlug: "almond-250", packageForm: "bottle" },
        { productSlug: "almond-500", packageForm: "bottle" },
      ],
    },
  ];
  const family = resolveCatalogueProductFamily(
    "almond-250",
    exactProducts,
    families,
  );
  assert.ok(family);

  const markup = renderToStaticMarkup(
    createElement(ProductSizeSelector, { family }),
  );
  assert.match(
    markup,
    /<a[^>]*aria-current="page"[^>]*href="\/products\/almond-250"/,
  );
  assert.match(markup, /href="\/products\/almond-500"/);
  assert.equal(markup.match(/aria-current="page"/g)?.length, 1);

  const page = readFileSync("app/(site)/products/[slug]/page.tsx", "utf8");
  assert.match(
    page,
    /resolveCatalogueProductFamily\(product\.slug, staticProducts\)/,
  );
  assert.match(page, /<ProductSizeSelector family=\{productFamily\}/);
  assert.match(page, /productFamily \? null : <span>\{product\.size\}<\/span>/);
});

test("a one-member public family renders the required selected 250 mL control only", () => {
  const family = resolveCatalogueProductFamily(loccitane250Slug, products);
  assert.ok(family);
  assert.equal(family.members.length, 1);

  const markup = renderToStaticMarkup(
    createElement(ProductSizeSelector, { family }),
  );
  assert.match(markup, /aria-label="Available product sizes"/);
  assert.match(markup, /aria-current="page"/);
  assert.match(markup, />250 mL<\/a>/);
  assert.doesNotMatch(markup, /500 mL|refill/i);
});
