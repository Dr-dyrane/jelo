export const catalogueProductPackageForms = ['bottle', 'refill'] as const;

export type CatalogueProductPackageForm = typeof catalogueProductPackageForms[number];

export type CatalogueProductFamilyMember = {
  productSlug: string;
  packageForm: CatalogueProductPackageForm;
};

export type CatalogueProductFamily = {
  id: string;
  members: readonly CatalogueProductFamilyMember[];
};

/**
 * Public-family membership is additive and exact-SKU only. A sibling belongs
 * here only after its own catalogue release; private research and visual
 * references never become route options through this sidecar.
 */
export const catalogueProductFamilies = [
  {
    id: 'loccitane-almond-shower-oil',
    members: [
      {
        productSlug: 'loccitane-almond-softening-shower-oil-250ml',
        packageForm: 'bottle',
      },
    ],
  },
] as const satisfies readonly CatalogueProductFamily[];
