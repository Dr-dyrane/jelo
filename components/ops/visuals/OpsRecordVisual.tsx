import type { ReactNode } from 'react';
import { SafeProductImage } from '@/components/products/safe-product-image';

type OpsRecordVisualProps = {
  image: string | null;
  className: string;
  imageClassName: string;
  fallback: ReactNode;
};

/**
 * One quiet visual stage for Ops records.
 *
 * A catalogue image is decorative context, not proof that every record is a
 * product. Callers must keep a truthful semantic fallback for records without
 * a reviewed public product image.
 */
export function OpsRecordVisual({
  image,
  className,
  imageClassName,
  fallback,
}: OpsRecordVisualProps) {
  return (
    <span className={className} aria-hidden="true">
      {image ? (
        <SafeProductImage src={image} alt="" className={imageClassName} />
      ) : fallback}
    </span>
  );
}
