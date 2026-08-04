type WithheldProductAsset = {
  fallbackUrl: string;
  reason: 'source-terms-prohibit-reuse';
  policyUrl: string;
  reviewedAt: string;
};

export const withheldProductAssets: Record<string, WithheldProductAsset> = {
} as const;
