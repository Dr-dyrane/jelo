import type { Metadata } from 'next';
import { IngredientExplorer, type IngredientCard } from '@/components/ingredients/ingredient-explorer';
import { products } from '@/data/catalogue';
import { ingredientSeeds, verifiedProductIngredients } from '@/data/product-ingredients';

export const metadata: Metadata = {
  title: 'Ingredients',
  description: 'Source-checked ingredients in the JeloCare catalogue.',
};

const ingredientCards: IngredientCard[] = ingredientSeeds.map(ingredient => ({
  slug: ingredient.slug,
  name: ingredient.commonName,
  inciName: ingredient.inciName,
  summary: ingredient.summary,
  evidenceGrade: ingredient.evidenceGrade,
  sensitiveSkinStatus: ingredient.sensitiveSkinStatus,
  products: Object.entries(verifiedProductIngredients).flatMap(([productSlug, productIngredients]) => {
    const product = products.find(item => item.slug === productSlug);
    if (!product) return [];
    return productIngredients
      .filter(item => item.ingredientSlug === ingredient.slug)
      .map(item => ({
        slug: product.slug,
        brand: product.brand,
        name: product.name,
        concentrationPercent: item.concentrationPercent,
        sourceUrl: item.sourceUrl,
      }));
  }),
})).filter(ingredient => ingredient.products.length > 0);

export default function IngredientsPage() {
  const productCount = new Set(ingredientCards.flatMap(ingredient => ingredient.products.map(product => product.slug))).size;

  return (
    <main className="page-shell">
      <header className="page-heading">
        <p className="eyebrow">Ingredient library</p>
        <h1>Know what’s<br/>inside.</h1>
        <p>{ingredientCards.length} ingredients. {productCount} source-checked products.</p>
      </header>
      <IngredientExplorer ingredients={ingredientCards}/>
      <p className="ingredient-library-note">Key ingredients only. Formulas can change. Check your pack.</p>
    </main>
  );
}
