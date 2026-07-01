/**
 * Reconcile Bridge payout drain rows with on-chain USDC sends to payout LAs,
 * and promote orphan chain sends before Bridge creates a drain record.
 */

import type { PayoutAddressResult } from '../../../lib/api/ramp/client';
import type { WalletTx } from '../hooks/useWalletHistory';
import { maxWalletTxLeg } from './walletTxConstants';

const USDC_SYMBOLS = new Set(['USDC', 'USDBC', 'USDC.E']);
const AMOUNT_TOLERANCE = 0.05;
const TIME_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function normHash(hash: string | undefined): string {
  return (hash ?? '').toLowerCase();
}

function normAddr(addr: string | undefined): string {
  return (addr ?? '').toLowerCase();
}

function isUsdcChainSend(tx: WalletTx): boolean {
  return (
    tx.source === 'chain'
    && tx.direction === 'out'
    && USDC_SYMBOLS.has(tx.tokenSymbol.toUpperCase())
    && tx.amount > 0
  );
}

function payoutSettlementAmount(tx: WalletTx): number {
  if (tx.source !== 'fiat_withdraw') return 0;
  return tx.amount > 0 ? tx.amount : 0;
}

function amountsMatch(a: number, b: number): boolean {
  if (a <= 0 || b <= 0) return false;
  return Math.abs(a - b) <= Math.max(AMOUNT_TOLERANCE, a * 0.01);
}

function timestampMs(tx: WalletTx): number {
  const ts = Date.parse(tx.timestamp);
  return Number.isFinite(ts) ? ts : 0;
}

function withinPayoutWindow(payout: WalletTx, chain: WalletTx): boolean {
  const payoutTs = timestampMs(payout);
  const chainTs = timestampMs(chain);
  if (payoutTs <= 0 || chainTs <= 0) return true;
  // Chain send usually precedes Bridge drain creation, but clocks can skew either way.
  return Math.abs(chainTs - payoutTs) <= TIME_WINDOW_MS;
}

function shouldPreferChainUsdcAmount(payout: WalletTx, chain: WalletTx, payoutAmount: number): boolean {
  if (payout.source !== 'fiat_withdraw') return false;
  if (chain.amount <= 0) return false;
  if (payoutAmount <= 0) return true;
  // Drain `amount` may be destination fiat, fees, or net — chain is USDC sent.
  return chain.amount > payoutAmount || !amountsMatch(payoutAmount, chain.amount);
}

function mergeChainSettlement(payout: WalletTx, chain: WalletTx): WalletTx {
  const merged: WalletTx = { ...payout };
  if (!merged.hash && chain.hash) merged.hash = chain.hash;
  if (!merged.fromAddress && chain.fromAddress) merged.fromAddress = chain.fromAddress;
  if (!merged.toAddress && chain.toAddress) merged.toAddress = chain.toAddress;

  const payoutAmount = payoutSettlementAmount(payout);
  const hashMatch =
    normHash(payout.hash) !== ''
    && normHash(payout.hash) === normHash(chain.hash);

  if (chain.amount > 0) {
    if (
      payoutAmount <= 0
      || amountsMatch(payoutAmount, chain.amount)
      || hashMatch
      || shouldPreferChainUsdcAmount(payout, chain, payoutAmount)
    ) {
      merged.amount = chain.amount;
      merged.rawValue = chain.rawValue;
    }
  }

  return merged;
}

function knownPayoutDepositAddresses(
  payout: WalletTx,
  payoutAddresses: PayoutAddressResult[],
): Set<string> {
  const addrs = new Set(
    payoutAddresses.map((row) => normAddr(row.depositAddress)).filter(Boolean),
  );
  const payoutTo = normAddr(payout.toAddress);
  if (payoutTo) addrs.add(payoutTo);
  return addrs;
}

function usdcOutLegsForHash(chains: WalletTx[], hash: string): WalletTx[] {
  return chains.filter(
    (chain) => normHash(chain.hash) === normHash(hash) && isUsdcChainSend(chain),
  );
}

function isPayoutLaRecipient(chain: WalletTx, payoutTos: Set<string>): boolean {
  return payoutTos.has(normAddr(chain.toAddress ?? chain.counterparty));
}

/** UserOps often include a large USDC→LA transfer plus a tiny USDC gas leg with the same hash. */
function pickBestPayoutChainLeg(
  payout: WalletTx,
  chains: WalletTx[],
  payoutAddresses: PayoutAddressResult[],
): WalletTx | null {
  const payoutTos = knownPayoutDepositAddresses(payout, payoutAddresses);
  const payoutHash = normHash(payout.hash);
  let candidates: WalletTx[] = [];

  if (payoutHash) {
    candidates = usdcOutLegsForHash(chains, payoutHash);
  }

  if (candidates.length === 0) {
    const targetAmount = payoutSettlementAmount(payout);
    candidates = chains.filter((chain) => {
      if (!isUsdcChainSend(chain)) return false;
      if (!withinPayoutWindow(payout, chain)) return false;
      const chainTo = normAddr(chain.toAddress ?? chain.counterparty);
      if (!isPayoutLaRecipient(chain, payoutTos)) return false;
      if (targetAmount <= 0 || amountsMatch(chain.amount, targetAmount)) return true;
      return payout.source === 'fiat_withdraw';
    });
  }

  if (candidates.length === 0) return null;

  const laLegs = candidates.filter((chain) => isPayoutLaRecipient(chain, payoutTos));
  const pool = laLegs.length > 0 ? laLegs : candidates;
  return maxWalletTxLeg(pool);
}

function markMatchedPayoutChainLegs(
  match: WalletTx,
  chains: WalletTx[],
  matchedChainIds: Set<string>,
): void {
  matchedChainIds.add(match.id);
  for (const leg of chains) {
    if (normHash(leg.hash) !== normHash(match.hash)) continue;
    if (!isUsdcChainSend(leg)) continue;
    matchedChainIds.add(leg.id);
  }
}

function findChainMatch(payout: WalletTx, chains: WalletTx[], payoutAddresses: PayoutAddressResult[]): WalletTx | null {
  return pickBestPayoutChainLeg(payout, chains, payoutAddresses);
}

function payoutAddressByDepositAddress(
  address: string,
  payoutAddresses: PayoutAddressResult[],
): PayoutAddressResult | null {
  const target = normAddr(address);
  return payoutAddresses.find((row) => normAddr(row.depositAddress) === target) ?? null;
}

function isInferredPayout(tx: WalletTx): boolean {
  return tx.source === 'fiat_withdraw' && tx.id.startsWith('fiat-withdraw-inferred-');
}

function inferredHashFromId(tx: WalletTx): string {
  return normHash(tx.id.replace('fiat-withdraw-inferred-', ''));
}

function payoutRowsRepresentSamePayout(api: WalletTx, inferred: WalletTx): boolean {
  const apiHash = normHash(api.hash);
  const inferredHash = normHash(inferred.hash);
  if (apiHash && inferredHash && apiHash === inferredHash) return true;
  if (apiHash && inferredHashFromId(inferred) === apiHash) return true;

  if (normAddr(api.toAddress) !== normAddr(inferred.toAddress)) return false;

  const tsDiff = Math.abs(timestampMs(api) - timestampMs(inferred));
  if (tsDiff > TIME_WINDOW_MS) return false;

  if (inferred.amount > 0 && (api.amount <= 0 || amountsMatch(api.amount, inferred.amount))) {
    return true;
  }

  return tsDiff <= 60 * 60 * 1000;
}

/** Drop inferred rows once Bridge returns a matching drain record. */
function dedupeInferredPayoutRows(payoutRows: WalletTx[]): WalletTx[] {
  const apiRows = payoutRows.filter((tx) => !isInferredPayout(tx));
  const inferredRows = payoutRows.filter(isInferredPayout);
  if (inferredRows.length === 0) return payoutRows;

  const consumedInferred = new Set<string>();
  const mergedApi = apiRows.map((api) => {
    const match = inferredRows.find(
      (inferred) => !consumedInferred.has(inferred.id) && payoutRowsRepresentSamePayout(api, inferred),
    );
    if (!match) return api;
    consumedInferred.add(match.id);
    return mergeChainSettlement(api, match);
  });

  const remainingInferred = inferredRows.filter((inferred) => !consumedInferred.has(inferred.id));
  return [...mergedApi, ...remainingInferred];
}

function toInferredFiatWithdraw(chain: WalletTx, payoutAddress: PayoutAddressResult): WalletTx {
  return {
    ...chain,
    id: `fiat-withdraw-inferred-${chain.hash || chain.id}`,
    source: 'fiat_withdraw',
    activityKind: undefined,
    activityDetailKey: undefined,
    activityDetailParams: undefined,
    activitySubkind: undefined,
    swapFromSymbol: undefined,
    swapToSymbol: undefined,
    counterparty: payoutAddress.destinationCurrency.toUpperCase(),
    counterpartyName: null,
    tokenSymbol: 'USDC',
    statusLabelKey: 'card.payoutStatusAwaitingBridge',
    statusColor: '#9CA3AF',
    statusPending: true,
    destinationRail: payoutAddress.destinationRail,
    destinationCurrency: payoutAddress.destinationCurrency,
    toAddress: payoutAddress.depositAddress,
  };
}

/**
 * Hide on-chain USDC sends that belong to a payout drain row and enrich the
 * payout row with hash / amount from chain when missing.
 */
export function reconcilePayoutAndChainTxs(
  txs: WalletTx[],
  payoutAddresses: PayoutAddressResult[] = [],
): WalletTx[] {
  const payoutRows = txs.filter((tx) => tx.source === 'fiat_withdraw');
  const chainRows = txs.filter((tx) => tx.source === 'chain');
  const otherRows = txs.filter(
    (tx) => tx.source !== 'chain' && tx.source !== 'fiat_withdraw',
  );

  if (payoutRows.length === 0 && payoutAddresses.length === 0) return txs;

  const matchedChainIds = new Set<string>();
  const reconciledPayout = payoutRows.map((payout) => {
    const availableChains = chainRows.filter((chain) => !matchedChainIds.has(chain.id));
    const match = findChainMatch(payout, availableChains, payoutAddresses);
    if (!match) return payout;
    markMatchedPayoutChainLegs(match, chainRows, matchedChainIds);
    return mergeChainSettlement(payout, match);
  });

  const dedupedPayout = dedupeInferredPayoutRows(reconciledPayout);

  const remainingChains = chainRows.filter((chain) => !matchedChainIds.has(chain.id));
  const promoted = remainingChains.flatMap((chain) => {
    if (!isUsdcChainSend(chain)) return [chain];
    const payoutAddress = payoutAddressByDepositAddress(
      chain.toAddress ?? chain.counterparty,
      payoutAddresses,
    );
    if (!payoutAddress) return [chain];
    const inferred = toInferredFiatWithdraw(chain, payoutAddress);
    const duplicate = dedupedPayout.some((row) => payoutRowsRepresentSamePayout(row, inferred));
    if (duplicate) return [];
    return [inferred];
  });

  return [...otherRows, ...dedupedPayout, ...promoted].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}
