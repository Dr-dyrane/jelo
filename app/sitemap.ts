import type { MetadataRoute } from "next";
import { concerns } from "@/data/knowledge";
import { ingredientSeeds } from "@/data/product-ingredients";
import { nigeriaRetailers, retailerSlug } from "@/data/retailers";
import { buildBrandDirectory } from "@/lib/catalogue/brand-profile";
import { listCatalogueProducts } from "@/lib/catalogue/repository";
import { hasShareableNgOffer } from "@/modules/commerce/shareable-offer";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await listCatalogueProducts();
  const brands = buildBrandDirectory(products);
  const now = new Date();
  const origin = "https://www.jelocare.com";
  return [
    { url: origin, lastModified: now, changeFrequency: "weekly", priority: 1 },
    {
      url: `${origin}/products`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${origin}/brands`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${origin}/ingredients`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${origin}/retailers`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${origin}/concerns`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${origin}/consult`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${origin}/contribute`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${origin}/share`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${origin}/lagos`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${origin}/search`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    ...concerns.map((concern) => ({
      url: `${origin}/concerns/${concern.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.75,
    })),
    ...products.map((product) => ({
      url: `${origin}/products/${product.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.75,
    })),
    ...brands.map((brand) => ({
      url: `${origin}/brands/${brand.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...nigeriaRetailers.map((retailer) => ({
      url: `${origin}/retailers/${retailerSlug(retailer.name)}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.65,
    })),
    ...products
      .filter((product) => hasShareableNgOffer(product))
      .map((product) => ({
        url: `${origin}/share/${product.slug}`,
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.65,
      })),
    ...ingredientSeeds.map((ingredient) => ({
      url: `${origin}/share/ingredient/${ingredient.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
