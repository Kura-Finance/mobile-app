/**
 * Morpho Borrow configuration — mainstream Base markets only.
 */

import type { MorphoMarket } from '../lib/api/morpho/markets';

/** Loan asset for Morpho Base borrow (USDC only). */
export const MORPHO_BORROW_LOAN_SYMBOLS = [
  'USDC',
] as const;

/** Collateral assets supported for borrow (WETH, LST, cbBTC, cbDOGE, SOL, cbXRP, USDe). */
export const MORPHO_BORROW_COLLATERAL_SYMBOLS = [
  'WETH',
  'ETH',
  'cbBTC',
  'cbDOGE',
  'DOGE',
  'SOL',
  'cbXRP',
  'XRP',
  'cbETH',
  'wstETH',
  'weETH',
  'rETH',
  'USDe',
] as const;

/** Minimum market supply TVL (USD) to surface in the list. */
export const MORPHO_BORROW_MIN_SUPPLY_USD = 5_000_000;

/** Per-collateral TVL floor overrides (e.g. newer cbDOGE market). */
export const MORPHO_BORROW_COLLATERAL_MIN_SUPPLY_USD: Partial<
  Record<(typeof MORPHO_BORROW_COLLATERAL_SYMBOLS)[number], number>
> = {
  cbDOGE: 1_000_000,
  DOGE: 1_000_000,
  SOL: 1_000_000,
};

/** Cap after filtering — keeps the list focused on top liquidity. */
export const MORPHO_BORROW_MAX_MARKETS = 24;

const loanSet = new Set(MORPHO_BORROW_LOAN_SYMBOLS.map((s) => s.toLowerCase()));
const collateralSet = new Set(MORPHO_BORROW_COLLATERAL_SYMBOLS.map((s) => s.toLowerCase()));

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toLowerCase();
}

function minSupplyUsdForCollateral(symbol: string): number {
  const key = normalizeSymbol(symbol);
  for (const [collateral, minUsd] of Object.entries(MORPHO_BORROW_COLLATERAL_MIN_SUPPLY_USD)) {
    if (normalizeSymbol(collateral) === key && minUsd != null) {
      return minUsd;
    }
  }
  return MORPHO_BORROW_MIN_SUPPLY_USD;
}

export function isMainstreamBorrowMarket(market: MorphoMarket): boolean {
  const loan = normalizeSymbol(market.loanAsset.symbol);
  const collateral = normalizeSymbol(market.collateralAsset.symbol);
  if (!loanSet.has(loan)) return false;
  if (!collateralSet.has(collateral)) return false;
  if (market.supplyAssetsUsd < minSupplyUsdForCollateral(market.collateralAsset.symbol)) return false;
  return true;
}

export function filterMainstreamBorrowMarkets(markets: MorphoMarket[]): MorphoMarket[] {
  return markets
    .filter(isMainstreamBorrowMarket)
    .sort((a, b) => b.supplyAssetsUsd - a.supplyAssetsUsd)
    .slice(0, MORPHO_BORROW_MAX_MARKETS);
}
