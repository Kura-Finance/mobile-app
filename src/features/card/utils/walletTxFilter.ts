/**
 * Wallet activity list visibility — hides sub-cent dust / spam transfers on Home.
 * Aligns with portfolio dust threshold in lib/api/debank/displayTokens.
 */

import { MIN_DISPLAY_TOKEN_USD } from '../../../lib/api/debank/displayTokens';
import type { WalletTx } from '../hooks/useWalletHistory';
import { isMorphoEarnShareSymbol } from './walletTxMorpho';
import { isUsdPeggedSymbol } from './walletTxConstants';

/** Base blue-chip tickers we show even at small notionals (aligned with crypto/config/blueChips). */
const KNOWN_SYMBOLS = new Set([
  'USDC', 'USDT', 'DAI', 'EURC', 'XSGD', 'AUDD', 'BRZ', 'MXNE', 'ETH', 'WETH', 'CBBTC', 'CBDOGE', 'CBETH',
  'AERO', 'WSTETH', 'MORPHO', 'USDY', 'OUSG', 'SUSDS', 'USR',
  'VIRTUAL', 'DEGEN', 'SOL',
]);

/** Minimum display amount for a token symbol (same ~$0.01 intent as portfolio dust). */
export function minWalletTxAmount(symbol: string): number {
  const sym = symbol.toUpperCase();
  if (isUsdPeggedSymbol(sym)) return MIN_DISPLAY_TOKEN_USD;
  if (sym === 'ETH' || sym === 'WETH') return MIN_DISPLAY_TOKEN_USD / 2000;
  if (sym === 'CBBTC' || sym === 'WBTC' || sym === 'BTC') return MIN_DISPLAY_TOKEN_USD / 60_000;
  if (sym === 'CBDOGE' || sym === 'DOGE') return MIN_DISPLAY_TOKEN_USD / 0.25;
  if (sym === 'SOL') return MIN_DISPLAY_TOKEN_USD / 150;
  if (KNOWN_SYMBOLS.has(sym)) return MIN_DISPLAY_TOKEN_USD;
  // Outgoing unknown tokens — still apply a small floor.
  return 1;
}

export function shouldDisplayWalletTx(tx: WalletTx): boolean {
  if (tx.activityKind === 'bridge_out') return false;
  // Buy/sell swaps emit two legs — show only the asset leg, not the payment/proceeds leg.
  if (tx.activityKind === 'buy' && tx.direction === 'out') return false;
  if (tx.activityKind === 'sell' && tx.direction === 'in') return false;
  // Fee-wrapper share receipts/burns are folded into Morpho Earn deposit/withdraw rows.
  if (isMorphoEarnShareSymbol(tx.tokenSymbol)) return false;

  if (tx.source !== 'chain') return true;

  const abs = Math.abs(tx.amount);
  if (abs === 0) return false;

  const sym = tx.tokenSymbol.toUpperCase();
  const isKnown = KNOWN_SYMBOLS.has(sym) || isUsdPeggedSymbol(sym);

  // Hide unsolicited airdrop spam (GBT, AMORA, fake "USA", etc.).
  if (tx.direction === 'in' && !isKnown) return false;

  return abs >= minWalletTxAmount(tx.tokenSymbol);
}

export function filterWalletTxsForDisplay(txs: WalletTx[]): WalletTx[] {
  return txs.filter(shouldDisplayWalletTx);
}
