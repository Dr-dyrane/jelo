/**
 * Type definition for the product-asset-repairs manifest. The JSON file is
 * checked in at `data/product-asset-repairs.json` and may be empty when no
 * generated repairs are active. This type keeps the consumers stable across
 * an empty or populated manifest.
 */

export type ProductAssetRepair = {
  id: string;
  productSlug: string;
  reason: string;
  identity: {
    gtin: string;
    officialProductUrl: string;
  };
  inputs: ReadonlyArray<{
    role: string;
    sha256: string;
    localPath?: string;
  }>;
  output: {
    localPath: string;
    blobUrl: string;
    byteSize: number;
    sha256: string;
    width: number;
    height: number;
  };
  review: {
    sourceDefectConfirmed: boolean;
    fullSilhouetteVisible: boolean;
    packagingIntact: boolean;
    labelVariantSizeUnchanged: boolean;
    backgroundTransparent: boolean;
    surfaces: readonly string[];
  };
};

export type ProductAssetRepairsManifest = {
  schemaVersion: number;
  repairs: ProductAssetRepair[];
};
