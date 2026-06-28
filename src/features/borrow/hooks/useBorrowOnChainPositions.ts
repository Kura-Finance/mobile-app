import { useCallback, useEffect, useRef, useState } from 'react';

import type { MorphoBorrowPosition, MorphoMarket } from '../../../lib/api/morpho/markets';
import {
  readMorphoUserPositionDisplay,
  toMorphoMarketParams,
} from '../../../lib/wallet/morphoBlue';

function toBorrowPosition(
  market: MorphoMarket,
  display: Awaited<ReturnType<typeof readMorphoUserPositionDisplay>>,
): MorphoBorrowPosition {
  return {
    marketId: market.marketId,
    loanSymbol: market.loanAsset.symbol,
    collateralSymbol: market.collateralAsset.symbol,
    borrowAssetsUsd: display.borrowAssetsUsd,
    collateralUsd: display.collateralUsd,
    borrowAssets: display.borrowAssetsRaw.toString(),
  };
}

export function useBorrowOnChainPositions(
  scaAddress: string | null,
  markets: MorphoMarket[],
) {
  const [positionsByMarket, setPositionsByMarket] = useState<
    Record<string, MorphoBorrowPosition>
  >({});
  const marketsRef = useRef(markets);
  marketsRef.current = markets;
  const requestId = useRef(0);

  const marketIdsKey = markets
    .map((m) => m.marketId.toLowerCase())
    .sort()
    .join(',');

  const refresh = useCallback(async () => {
    const currentMarkets = marketsRef.current;
    if (!scaAddress || currentMarkets.length === 0) {
      setPositionsByMarket((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }

    const id = ++requestId.current;
    const user = scaAddress as `0x${string}`;
    const entries = await Promise.all(
      currentMarkets.map(async (market) => {
        if (!market.oracleAddress || !market.irmAddress) return null;
        try {
          const display = await readMorphoUserPositionDisplay(
            toMorphoMarketParams(market),
            user,
          );
          if (!display.hasDebt && display.collateralRaw <= 0n) return null;
          return [market.marketId.toLowerCase(), toBorrowPosition(market, display)] as const;
        } catch {
          return null;
        }
      }),
    );

    if (id !== requestId.current) return;

    const next = Object.fromEntries(
      entries.filter((entry): entry is readonly [string, MorphoBorrowPosition] => entry != null),
    );
    setPositionsByMarket((prev) => {
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (
        prevKeys.length === nextKeys.length
        && prevKeys.every((k) =>
          prev[k]?.borrowAssetsUsd === next[k]?.borrowAssetsUsd
          && prev[k]?.collateralUsd === next[k]?.collateralUsd,
        )
      ) {
        return prev;
      }
      return next;
    });
  }, [scaAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh, marketIdsKey]);

  return { onChainPositionsByMarket: positionsByMarket, refreshOnChainPositions: refresh };
}
