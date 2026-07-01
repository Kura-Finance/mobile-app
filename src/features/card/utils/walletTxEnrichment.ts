/**
 * Groups on-chain token legs by tx hash and labels them with user-facing actions
 * (Buy, Sell, Swap, Send, Receive, Bridge) instead of raw transfer direction.
 */

import type { WalletTx } from '../hooks/useWalletHistory';
import { classifyMorphoActivities, tryClassifyMorphoEarnShareFlow } from './walletTxMorpho';
import { isUsdPeggedSymbol, maxWalletTxLeg, tokenSymbolUpper } from './walletTxConstants';

export type WalletActivityKind =
  | 'buy'
  | 'sell'
  | 'swap'
  | 'send'
  | 'receive'
  | 'bridge_out'
  | 'borrow'
  | 'repay'
  | 'deposit'
  | 'withdraw';

/** Li.Fi Diamond on Base — primary swap/bridge router. */
export const LIFI_DIAMOND_BASE = '0x1231deb6f5749ef6eb6945a5747841f669ba883e';

function norm(addr: string | undefined): string {
  return (addr ?? '').toLowerCase();
}

function sym(token: string): string {
  return tokenSymbolUpper(token);
}

export function isLifiAddress(address: string | undefined): boolean {
  return norm(address) === LIFI_DIAMOND_BASE;
}

function touchesLifi(tx: WalletTx): boolean {
  return (
    isLifiAddress(tx.counterparty) ||
    isLifiAddress(tx.fromAddress) ||
    isLifiAddress(tx.toAddress)
  );
}

function maxLeg(legs: WalletTx[]): WalletTx {
  return maxWalletTxLeg(legs);
}

function classifySwapKind(fromSymbol: string, toSymbol: string): WalletActivityKind {
  const from = sym(fromSymbol);
  const to = sym(toSymbol);
  if (isUsdPeggedSymbol(from) && !isUsdPeggedSymbol(to)) return 'buy';
  if (!isUsdPeggedSymbol(from) && isUsdPeggedSymbol(to)) return 'sell';
  return 'swap';
}

function buildActivityTx(
  base: WalletTx,
  kind: WalletActivityKind,
  display: { symbol: string; amount: number; direction: WalletTx['direction'] },
  detail: { key: string; params?: Record<string, string> },
  legs: { fromSymbol?: string; toSymbol?: string },
): WalletTx {
  return {
    ...base,
    id: `activity-${base.hash}-${kind}-${sym(display.symbol)}-${display.direction}`,
    activityKind: kind,
    direction: display.direction,
    tokenSymbol: display.symbol,
    amount: display.amount,
    counterpartyName: null,
    activityDetailKey: detail.key,
    activityDetailParams: detail.params,
    swapFromSymbol: legs.fromSymbol,
    swapToSymbol: legs.toSymbol,
  };
}

function tryConsolidateHashGroup(legs: WalletTx[]): WalletTx[] | null {
  if (legs.length <= 1) return null;

  const outs = legs.filter((t) => t.direction === 'out');
  const ins = legs.filter((t) => t.direction === 'in');
  if (outs.length === 0 || ins.length === 0) return null;

  const primaryOut = maxLeg(outs);
  const primaryIn = maxLeg(ins);
  const viaLifi = legs.some(touchesLifi);
  const kind = classifySwapKind(primaryOut.tokenSymbol, primaryIn.tokenSymbol);

  const fromSymbol = sym(primaryOut.tokenSymbol);
  const toSymbol = sym(primaryIn.tokenSymbol);
  const detailKey = viaLifi ? 'card.txDetailLifiPair' : 'card.txDetailPair';
  const detailParams = { from: fromSymbol, to: toSymbol };
  const legMeta = { fromSymbol, toSymbol };

  if (kind === 'buy') {
    return [
      buildActivityTx(
        primaryOut,
        'buy',
        { symbol: primaryOut.tokenSymbol, amount: primaryOut.amount, direction: 'out' },
        { key: detailKey, params: detailParams },
        legMeta,
      ),
      buildActivityTx(
        primaryIn,
        'buy',
        { symbol: primaryIn.tokenSymbol, amount: primaryIn.amount, direction: 'in' },
        { key: detailKey, params: detailParams },
        legMeta,
      ),
    ];
  }

  if (kind === 'sell') {
    return [
      buildActivityTx(
        primaryOut,
        'sell',
        { symbol: primaryOut.tokenSymbol, amount: primaryOut.amount, direction: 'out' },
        { key: detailKey, params: detailParams },
        legMeta,
      ),
      buildActivityTx(
        primaryIn,
        'sell',
        { symbol: primaryIn.tokenSymbol, amount: primaryIn.amount, direction: 'in' },
        { key: detailKey, params: detailParams },
        legMeta,
      ),
    ];
  }

  const display = {
    symbol: primaryIn.tokenSymbol,
    amount: primaryIn.amount,
    direction: 'self' as const,
  };

  return [
    buildActivityTx(
      primaryIn,
      kind,
      display,
      { key: detailKey, params: detailParams },
      legMeta,
    ),
  ];
}

function enrichSingleLeg(tx: WalletTx): WalletTx {
  if (tx.source !== 'chain' || tx.activityKind) return tx;

  if (tx.direction === 'out') {
    if (isLifiAddress(tx.counterparty) || isLifiAddress(tx.toAddress)) {
      return {
        ...tx,
        activityKind: 'bridge_out',
        activityDetailKey: 'card.txDetailViaLifi',
      };
    }
    return {
      ...tx,
      activityKind: 'send',
      activityDetailKey: 'card.txDetailToAddress',
      activityDetailParams: { address: tx.counterparty },
    };
  }

  if (tx.direction === 'in') {
    if (isLifiAddress(tx.counterparty) || isLifiAddress(tx.fromAddress)) {
      return {
        ...tx,
        activityKind: 'receive',
        activityDetailKey: 'card.txDetailFromLifi',
        activityDetailParams: { symbol: sym(tx.tokenSymbol) },
      };
    }
    return {
      ...tx,
      activityKind: 'receive',
      activityDetailKey: 'card.txDetailFromAddress',
      activityDetailParams: { address: tx.counterparty },
    };
  }

  return tx;
}

/** Merge same-hash swap legs and attach semantic activity labels. */
export function enrichWalletActivities(txs: WalletTx[]): WalletTx[] {
  const nonChain: WalletTx[] = [];
  const chainByHash = new Map<string, WalletTx[]>();

  for (const tx of txs) {
    if (tx.source !== 'chain' || !tx.hash) {
      nonChain.push(tx);
      continue;
    }
    const bucket = chainByHash.get(tx.hash) ?? [];
    bucket.push(tx);
    chainByHash.set(tx.hash, bucket);
  }

  const enrichedChain: WalletTx[] = [];

  for (const legs of chainByHash.values()) {
    const earnShareFlow = tryClassifyMorphoEarnShareFlow(legs);
    if (earnShareFlow) {
      enrichedChain.push(...earnShareFlow);
      continue;
    }

    const { activities: morphoActivities, otherLegs } = classifyMorphoActivities(legs);

    if (morphoActivities.length > 0) {
      enrichedChain.push(...morphoActivities);
      if (otherLegs.length === 0) continue;

      const consolidated = tryConsolidateHashGroup(otherLegs);
      if (consolidated) {
        enrichedChain.push(...consolidated);
      } else {
        enrichedChain.push(...otherLegs.map(enrichSingleLeg));
      }
      continue;
    }

    const consolidated = tryConsolidateHashGroup(legs);
    if (consolidated) {
      enrichedChain.push(...consolidated);
      continue;
    }
    enrichedChain.push(...legs.map(enrichSingleLeg));
  }

  return [...nonChain, ...enrichedChain].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}
