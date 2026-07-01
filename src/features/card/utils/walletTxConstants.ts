/**
 * Shared wallet transaction helpers used across enrichment, display, and filtering.
 */

import type { WalletTx } from '../hooks/useWalletHistory';

export const USD_PEGGED_SYMBOLS = [
  'USDC',
  'USDT',
  'DAI',
  'USDBC',
  'USD+',
  'EURC',
  'USDC.E',
  'USDBC.E',
] as const;

const USD_PEGGED = new Set<string>(USD_PEGGED_SYMBOLS);

export function tokenSymbolUpper(symbol: string): string {
  return symbol.toUpperCase();
}

export function isUsdPeggedSymbol(symbol: string): boolean {
  return USD_PEGGED.has(tokenSymbolUpper(symbol));
}

/** Pick the leg with the largest token amount in a multi-leg transaction. */
export function maxWalletTxLeg(legs: WalletTx[]): WalletTx {
  return legs.reduce((best, leg) => (leg.amount > best.amount ? leg : best), legs[0]);
}
