import manifest from './editorial-assets.json';

export type EditorialAsset = {
  id: string;
  role:
    | 'homepage-hero'
    | 'homepage-story'
    | 'concern-cutout'
    | 'catalogue-hero'
    | 'catalogue-story'
    | 'consult-story'
    | 'concerns-story'
    | 'ingredient-story';
  localPath: string;
  blobUrl: string;
  altText: string;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  transparent: boolean;
  sourceKind?: 'generated' | 'licensed' | 'owned';
  contentHash?: string;
};

export const editorialAssets = manifest as EditorialAsset[];

const editorialAssetIndex = new Map(editorialAssets.map(asset => [asset.id, asset]));

export function editorialAsset(id: string) {
  const asset = editorialAssetIndex.get(id);
  if (!asset) throw new Error(`Missing editorial asset: ${id}`);
  return asset;
}
