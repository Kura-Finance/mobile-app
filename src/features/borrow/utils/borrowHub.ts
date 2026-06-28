import type { MorphoBorrowPosition, MorphoMarket } from '../../../lib/api/morpho/markets';
import { isMainstreamBorrowMarket } from '../../../config/borrow';
import { parseMarketMaxLltv } from './borrowLtv';

const COLLATERAL_LABELS: Record<string, string> = {
  cbbtc: 'Bitcoin',
  cbdoge: 'Dogecoin',
  doge: 'Dogecoin',
  sol: 'Solana',
  cbxrp: 'XRP',
  xrp: 'XRP',
  weth: 'Ethereum',
  eth: 'Ethereum',
  cbeth: 'Ethereum',
  wsteth: 'Ethereum',
  weeth: 'Ethereum',
  reth: 'Ethereum',
  usde: 'USDe',
};

export function collateralDisplayName(symbol: string): string {
  const key = symbol.trim().toLowerCase();
  return COLLATERAL_LABELS[key] ?? symbol;
}

export function loanDisplayName(collateralSymbol: string): string {
  return `${collateralDisplayName(collateralSymbol)} Loan`;
}

/** Morpho WETH/ETH markets require at least this much collateral to supply. */
export const MORPHO_WETH_MIN_COLLATERAL = 0.001;

export function morphoMinCollateralAmount(symbol: string): number | null {
  const upper = symbol.toUpperCase();
  if (upper === 'WETH' || upper === 'ETH') return MORPHO_WETH_MIN_COLLATERAL;
  return null;
}

export function isMorphoMinCollateralMet(amount: number, symbol: string): boolean {
  if (amount <= 0) return false;
  const min = morphoMinCollateralAmount(symbol);
  if (min == null) return true;
  return amount >= min - 1e-12;
}

function formatTokenAmount(n: number): string {
  if (n === 0) return '0.00';
  if (n < 0.0001) return n.toExponential(2);
  if (n < 1) return n.toFixed(6);
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

/** Wallet available for borrow collateral — WETH/ETH below Morpho min shows "<0.001". */
export function formatBorrowAvailableAmount(amount: number, symbol: string): string {
  const upper = symbol.toUpperCase();
  if (
    (upper === 'WETH' || upper === 'ETH')
    && amount > 0
    && amount < MORPHO_WETH_MIN_COLLATERAL
  ) {
    return '<0.001';
  }
  return formatTokenAmount(amount);
}

/** Wallet collateral available for a borrow market (WETH markets use WETH only). */
export function walletCollateralAmount(symbol: string, balances: Record<string, number>): number {
  const upper = symbol.toUpperCase();
  if (upper === 'WETH' || upper === 'ETH') {
    return balances.WETH ?? 0;
  }
  if (upper === 'DOGE') {
    return balances.cbDOGE ?? balances.DOGE ?? 0;
  }
  if (upper === 'CBXRP' || upper === 'XRP') {
    return balances.XRP ?? balances.cbXRP ?? 0;
  }
  return balances[upper] ?? 0;
}

/** Borrow MAX button — whole units only (no fractional part). */
export function formatBorrowMaxInput(maxBorrow: number): string {
  if (maxBorrow <= 0) return '';
  if (maxBorrow >= 1) return String(Math.floor(maxBorrow));
  return maxBorrow.toFixed(4).replace(/\.?0+$/, '');
}

export interface BorrowHubSummary {
  totalCollateralUsd: number;
  totalBorrowedUsd: number;
  availableCreditUsd: number;
}

export function computeBorrowHubSummary(
  positions: MorphoBorrowPosition[],
  marketsById: Map<string, MorphoMarket>,
): BorrowHubSummary {
  let totalCollateralUsd = 0;
  let totalBorrowedUsd = 0;
  let availableCreditUsd = 0;

  for (const position of positions) {
    if (position.borrowAssetsUsd <= 0) continue;
    totalCollateralUsd += position.collateralUsd;
    totalBorrowedUsd += position.borrowAssetsUsd;

    const market = marketsById.get(position.marketId.toLowerCase());
    const maxLltv = market ? parseMarketMaxLltv(market.lltv) : null;
    if (maxLltv != null && position.collateralUsd > 0) {
      const maxBorrow = position.collateralUsd * maxLltv;
      availableCreditUsd += Math.max(0, maxBorrow - position.borrowAssetsUsd);
    }
  }

  return { totalCollateralUsd, totalBorrowedUsd, availableCreditUsd };
}

/** One USDC loan market per collateral — lowest borrow APY among eligible markets. */
export function pickMarketsByCollateral(markets: MorphoMarket[]): MorphoMarket[] {
  const byCollateral = new Map<string, MorphoMarket>();

  for (const market of markets) {
    if (!isMainstreamBorrowMarket(market)) continue;

    const key = market.collateralAsset.symbol.toLowerCase();
    const apy = market.avgNetBorrowApy || market.borrowApy;
    const existing = byCollateral.get(key);
    if (!existing) {
      byCollateral.set(key, market);
      continue;
    }
    const existingApy = existing.avgNetBorrowApy || existing.borrowApy;
    if (apy < existingApy) {
      byCollateral.set(key, market);
    }
  }

  return [...byCollateral.values()].sort(
    (a, b) => b.liquidityAssetsUsd - a.liquidityAssetsUsd,
  );
}

/** Hide collateral markets that already have an active loan in My Loans. */
export function filterBorrowWithMarkets(
  collateralMarkets: MorphoMarket[],
  activeLoans: { market: MorphoMarket; position: MorphoBorrowPosition }[],
): MorphoMarket[] {
  if (activeLoans.length === 0) return collateralMarkets;

  const activeCollateralKeys = new Set(
    activeLoans.map(({ market }) => market.collateralAsset.symbol.toLowerCase()),
  );

  return collateralMarkets.filter(
    (market) => !activeCollateralKeys.has(market.collateralAsset.symbol.toLowerCase()),
  );
}

export function activeLoanEntries(
  positions: MorphoBorrowPosition[],
  markets: MorphoMarket[],
) {
  const marketById = new Map(
    markets.map((m) => [m.marketId.toLowerCase(), m]),
  );

  return positions
    .filter((p) => p.borrowAssetsUsd > 0)
    .map((position) => {
      const market = marketById.get(position.marketId.toLowerCase());
      return market ? { market, position } : null;
    })
    .filter((item): item is { market: MorphoMarket; position: MorphoBorrowPosition } => item !== null)
    .sort((a, b) => b.position.borrowAssetsUsd - a.position.borrowAssetsUsd);
}
