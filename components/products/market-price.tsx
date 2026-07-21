'use client';

import { useEffect, useState } from 'react';
import { formatBaselinePrice, inferMarket, type Market } from '@/data/prices';

export function MarketPrice({ slug }: { slug: string }) {
  const [market, setMarket] = useState<Market>('NG');
  useEffect(() => setMarket(inferMarket()), []);
  return <>{formatBaselinePrice(slug, market)}</>;
}
