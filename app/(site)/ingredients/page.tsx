import type { Metadata } from "next";
import {
  IngredientExplorer,
  type IngredientCard,
} from "@/components/ingredients/ingredient-explorer";
import { products } from "@/data/catalogue";
import {
  ingredientSeeds,
  verifiedProductIngredients,
} from "@/data/product-ingredients";
import { ingredientById } from "@/modules/clinical/core/ingredients";
import { publicSocialMetadata, staticSocialCard } from "@/lib/og/social-card";
import styles from "@/components/ingredients/ingredient-explorer.module.css";

export const metadata: Metadata = publicSocialMetadata(
  staticSocialCard("ingredients"),
  "/ingredients",
);

const ingredientCards: IngredientCard[] = ingredientSeeds
  .map((ingredient) => {
    const knowledge = ingredientById.get(ingredient.slug);
    return {
      slug: ingredient.slug,
      name: ingredient.commonName,
      inciName: ingredient.inciName,
      summary: ingredient.summary,
      evidenceGrade: ingredient.evidenceGrade,
      sensitiveSkinStatus: ingredient.sensitiveSkinStatus,
      products: Object.entries(verifiedProductIngredients).flatMap(
        ([productSlug, productIngredients]) => {
          const product = products.find((item) => item.slug === productSlug);
          if (!product) return [];
          return productIngredients
            .filter((item) => item.ingredientSlug === ingredient.slug)
            .map((item) => ({
              slug: product.slug,
              brand: product.brand,
              name: product.name,
              concentrationPercent: item.concentrationPercent,
              sourceUrl: item.sourceUrl,
            }));
        },
      ),
      // Enrich with clinical knowledge where available
      family: knowledge?.family,
      concerns: knowledge?.concerns,
      allowedTimes: knowledge?.allowedTimes,
      pregnancyStatus: knowledge?.pregnancy,
      nursingStatus: knowledge?.breastfeeding,
      photosensitivity: knowledge?.photosensitivity,
      irritationRisk: knowledge?.irritationRisk,
    };
  })
  .filter((ingredient) => ingredient.products.length > 0);

export default function IngredientsPage() {
  const productCount = new Set(
    ingredientCards.flatMap((ingredient) =>
      ingredient.products.map((product) => product.slug),
    ),
  ).size;

  return (
    <main className="page-shell">
      <section
        className={styles.intro}
        aria-labelledby="ingredient-library-title"
      >
        <header className={styles.introCopy}>
          <p className="eyebrow">Ingredient library</p>
          <h1 id="ingredient-library-title">Know what’s inside.</h1>
          <p>
            Search {ingredientCards.length} key ingredients across{" "}
            {productCount} source-checked products.
          </p>
        </header>
        <ol
          className={styles.introSteps}
          aria-label="How to use the ingredient library"
        >
          <li>
            <span>01</span>Find an ingredient or product.
          </li>
          <li>
            <span>02</span>Read the evidence and cautions.
          </li>
          <li>
            <span>03</span>Open a related guide or product.
          </li>
        </ol>
      </section>
      <IngredientExplorer ingredients={ingredientCards} />
      <p className="ingredient-library-note">
        Key ingredients only. Formulas change. Check your pack.
      </p>
    </main>
  );
}
