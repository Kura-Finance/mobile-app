import { useCallback, useEffect, useRef, useState } from 'react';
import { parseUnits } from 'viem';

import type { MorphoBorrowPosition, MorphoMarket } from '../../../lib/api/morpho/markets';
import {
  computeRemainingBorrowRaw,
  loanRawToAmount,
  ORACLE_PRICE_SCALE,
  readMorphoOnChainPosition,
  readMorphoOraclePrice,
  toMorphoMarketParams,
} from '../../../lib/wallet/morphoBlue';
import type { TokenBalances } from '../../crypto/hooks/useBaseBalances';
import {
  isMorphoMinCollateralMet,
  walletCollateralAmount,
} from '../utils/borrowHub';

function amountToRaw(amount: number, decimals: number): bigint {
  if (amount <= 0) return 0n;
  const raw = amount.toString();
  const [whole, frac = ''] = raw.split('.');
  const safe = frac ? `${whole}.${frac.slice(0, decimals)}` : whole;
  try {
    return parseUnits(safe as `${number}`, decimals);
  } catch {
    return 0n;
  }
}

function balancesKey(balances: TokenBalances): string {
  return Object.keys(balances)
    .sort()
    .map((k) => `${k}:${balances[k]}`)
    .join('|');
}

function positionsKey(positionsByMarket: Record<string, MorphoBorrowPosition>): string {
  return Object.entries(positionsByMarket)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, p]) => `${id}:${p.borrowAssets ?? '0'}`)
    .join('|');
}

function collateralUsdFromRaw(
  collateralRaw: bigint,
  oraclePrice: bigint,
  loanDecimals: number,
): number {
  if (collateralRaw <= 0n || oraclePrice <= 0n) return 0;
  const loanRaw = (collateralRaw * oraclePrice) / ORACLE_PRICE_SCALE;
  return loanRawToAmount(loanRaw, loanDecimals);
}

function effectiveCollateralRaw(params: {
  symbol: string;
  walletAmount: number;
  onChainRaw: bigint;
  collateralDecimals: number;
  borrowRaw: bigint;
}): bigint {
  const { symbol, walletAmount, onChainRaw, collateralDecimals, borrowRaw } = params;
  const onChainFormatted = Number(onChainRaw) / 10 ** collateralDecimals;
  const hasDebt = borrowRaw > 0n;

  const walletEffective = isMorphoMinCollateralMet(walletAmount, symbol) ? walletAmount : 0;
  const walletRaw = amountToRaw(walletEffective, collateralDecimals);

  let onChainEffective = onChainRaw;
  if (
    !hasDebt
    && onChainFormatted > 0
    && !isMorphoMinCollateralMet(onChainFormatted, symbol)
  ) {
    onChainEffective = 0n;
  }

  return onChainEffective + walletRaw;
}

async function computeMarketBorrowCapacity(
  market: MorphoMarket,
  user: `0x${string}`,
  walletBalances: TokenBalances,
  position?: MorphoBorrowPosition,
): Promise<{ maxUsd: number; collateralUsd: number }> {
  if (!market.oracleAddress || !market.irmAddress) {
    return { maxUsd: 0, collateralUsd: 0 };
  }

  try {
    const mp = toMorphoMarketParams(market);
    const walletAmount = walletCollateralAmount(market.collateralAsset.symbol, walletBalances);

    const [oraclePrice, onChain] = await Promise.all([
      readMorphoOraclePrice(mp.oracle),
      readMorphoOnChainPosition(mp, user),
    ]);

    let borrowRaw = 0n;
    try {
      borrowRaw = BigInt(position?.borrowAssets ?? '0');
    } catch {
      borrowRaw = 0n;
    }

    const totalCollateralRaw = effectiveCollateralRaw({
      symbol: market.collateralAsset.symbol,
      walletAmount,
      onChainRaw: onChain.collateralRaw,
      collateralDecimals: market.collateralAsset.decimals,
      borrowRaw,
    });

    if (totalCollateralRaw <= 0n) {
      return { maxUsd: 0, collateralUsd: 0 };
    }

    const remainingRaw = computeRemainingBorrowRaw({
      collateralRaw: totalCollateralRaw,
      borrowRaw,
      oraclePrice,
      lltv: mp.lltv,
    });

    return {
      maxUsd: loanRawToAmount(remainingRaw, market.loanAsset.decimals),
      collateralUsd: collateralUsdFromRaw(
        totalCollateralRaw,
        oraclePrice,
        market.loanAsset.decimals,
      ),
    };
  } catch {
    return { maxUsd: 0, collateralUsd: 0 };
  }
}

function maxMapsEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => a[k] === b[k]);
}

export function useBorrowMaxByMarket(
  scaAddress: string | null,
  markets: MorphoMarket[],
  positionsByMarket: Record<string, MorphoBorrowPosition>,
  walletBalances: TokenBalances,
) {
  const [maxByMarketId, setMaxByMarketId] = useState<Record<string, number>>({});
  const [collateralUsdByMarketId, setCollateralUsdByMarketId] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  const marketsRef = useRef(markets);
  const positionsRef = useRef(positionsByMarket);
  const balancesRef = useRef(walletBalances);
  marketsRef.current = markets;
  positionsRef.current = positionsByMarket;
  balancesRef.current = walletBalances;

  const marketIdsKey = markets.map((m) => m.marketId.toLowerCase()).sort().join(',');
  const positionsKeyValue = positionsKey(positionsByMarket);
  const balancesKeyValue = balancesKey(walletBalances);

  const load = useCallback(async () => {
    const currentMarkets = marketsRef.current;
    const currentPositions = positionsRef.current;
    const currentBalances = balancesRef.current;

    if (!scaAddress || currentMarkets.length === 0) {
      setMaxByMarketId((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      setCollateralUsdByMarketId((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      setLoading(false);
      return;
    }

    const id = ++requestId.current;
    setLoading(true);

    const user = scaAddress as `0x${string}`;
    const entries = await Promise.all(
      currentMarkets.map(async (market) => {
        const position = currentPositions[market.marketId.toLowerCase()];
        const result = await computeMarketBorrowCapacity(
          market,
          user,
          currentBalances,
          position,
        );
        return [market.marketId.toLowerCase(), result] as const;
      }),
    );

    if (id !== requestId.current) return;

    const nextMax = Object.fromEntries(entries.map(([key, v]) => [key, v.maxUsd]));
    const nextCollateral = Object.fromEntries(entries.map(([key, v]) => [key, v.collateralUsd]));

    setMaxByMarketId((prev) => (maxMapsEqual(prev, nextMax) ? prev : nextMax));
    setCollateralUsdByMarketId((prev) => (maxMapsEqual(prev, nextCollateral) ? prev : nextCollateral));
    setLoading(false);
  }, [scaAddress]);

  useEffect(() => {
    setMaxByMarketId({});
    setCollateralUsdByMarketId({});
    void load();
  }, [load, marketIdsKey, positionsKeyValue, balancesKeyValue]);

  return { maxByMarketId, collateralUsdByMarketId, loading, refresh: load };
}
