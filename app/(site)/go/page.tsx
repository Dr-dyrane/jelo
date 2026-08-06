import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { resolveHandoff } from '@/lib/commerce/handoff-model';
import { HandoffView } from '@/components/commerce/handoff-view';

export const revalidate = 3600;

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ product?: string; retailer?: string }> }): Promise<Metadata> {
  const { product, retailer } = await searchParams;
  if (!product || !retailer) return {};
  const model = await resolveHandoff(product, retailer);
  if (!model) return {};
  return {
    title: `${model.productBrand} ${model.productName} · ${retailer}`,
    description: `Continuing to ${retailer} for ${model.productBrand} ${model.productName}.`,
    robots: { index: false, follow: false },
  };
}

export default async function GoPage({ searchParams }: { searchParams: Promise<{ product?: string; retailer?: string }> }) {
  const { product, retailer } = await searchParams;
  if (!product || !retailer) notFound();
  const model = await resolveHandoff(product, retailer);
  if (!model || !model.selectedOffer) notFound();
  return <HandoffView model={model} />;
}
