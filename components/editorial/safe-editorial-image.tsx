'use client';

import Image, { type ImageProps } from 'next/image';
import { useState } from 'react';
import type { EditorialAsset } from '@/data/editorial';

type Props = Omit<ImageProps, 'src' | 'width' | 'height' | 'onError'> & {
  asset: EditorialAsset;
};

export function SafeEditorialImage({ asset, alt, ...props }: Props) {
  const [src, setSrc] = useState(asset.blobUrl);

  return (
    <Image
      {...props}
      src={src}
      alt={alt}
      width={asset.width}
      height={asset.height}
      onError={() => {
        if (src !== asset.localPath) setSrc(asset.localPath);
      }}
    />
  );
}
