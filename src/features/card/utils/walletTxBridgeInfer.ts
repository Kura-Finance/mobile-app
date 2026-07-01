/**
 * When Bridge deposit webhooks haven't populated GET /deposits yet, label
 * USDC settlements as fiat on-ramps for users who have Bridge virtual accounts.
 */

import type { WalletTx } from '../hooks/useWalletHistory';

const USDC_SYMBOLS = new Set(['USDC', 'USDBC', 'USDC.E']);

function toInferredFiatDeposit(chain: WalletTx): WalletTx {
  return {
    ...chain,
    id: `fiat-inferred-${chain.hash || chain.id}`,
    source: 'fiat_deposit',
    activityKind: undefined,
    activityDetailKey: undefined,
    activityDetailParams: undefined,
    activitySubkind: undefined,
    swapFromSymbol: undefined,
    swapToSymbol: undefined,
    counterparty: 'USD',
    counterpartyName: null,
    tokenSymbol: 'USDC',
    statusLabelKey: 'card.statusCompleted',
    statusColor: '#10B981',
    statusPending: false,
  };
}

function isUnmatchedUsdcReceive(tx: WalletTx): boolean {
  return (
    tx.source === 'chain'
    && tx.direction === 'in'
    && USDC_SYMBOLS.has(tx.tokenSymbol.toUpperCase())
    && tx.amount > 0
  );
}

export interface PromoteBridgeFiatOptions {
  /** User has at least one Bridge virtual account from GET /onramp. */
  userHasBridgeAccounts: boolean;
  /** Rows returned from GET /deposits (+ per-VA deposits). */
  apiDepositCount: number;
}

/**
 * After reconcile, promote orphan USDC receives when the user uses Bridge VA
 * but deposit webhooks haven't written GET /deposits yet.
 */
export function promoteLikelyBridgeFiatFromChain(
  txs: WalletTx[],
  opts: PromoteBridgeFiatOptions,
): WalletTx[] {
  if (!opts.userHasBridgeAccounts) return txs;

  const bridgeApiRows = txs.filter(
    (tx) => tx.source === 'fiat_deposit' || tx.source === 'crypto_deposit',
  );
  const hasUnmatchedUsdc = txs.some(isUnmatchedUsdcReceive);

  // API returned deposit rows — reconcile should own matching; avoid mislabeling P2P.
  if (opts.apiDepositCount > 0 && bridgeApiRows.length > 0) {
    return txs;
  }

  // VA exists but no deposit records yet (webhook lag / DB empty) — infer from chain.
  if (!hasUnmatchedUsdc) return txs;

  return txs.map((tx) => (isUnmatchedUsdcReceive(tx) ? toInferredFiatDeposit(tx) : tx));
}

export function hasUnreconciledUsdcReceives(txs: WalletTx[]): boolean {
  return txs.some(isUnmatchedUsdcReceive);
}
