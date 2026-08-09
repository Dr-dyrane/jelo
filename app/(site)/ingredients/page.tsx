import type { Metadata } from "next";
import { IngredientExplorer } from "@/components/ingredients/ingredient-explorer";
import { listCatalogueProducts } from "@/lib/catalogue/repository";
import { buildIngredientLibraryCards } from "@/lib/clinical/ingredient-library";
import { publicSocialMetadata, staticSocialCard } from "@/lib/og/social-card";
import styles from "@/components/ingredients/ingredient-explorer.module.css";

export const metadata: Metadata = publicSocialMetadata(
  staticSocialCard("ingredients"),
  "/ingredients",
);

export default async function IngredientsPage() {
  const ingredientCards = buildIngredientLibraryCards(
    await listCatalogueProducts(),
  );
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
