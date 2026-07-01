/**
 * Reconcile Bridge fiat/crypto deposit rows with on-chain USDC settlement
 * transfers so users see "Fiat deposit" instead of "External wallet".
 */

import type { WalletTx } from '../hooks/useWalletHistory';

const USDC_SYMBOLS = new Set(['USDC', 'USDBC', 'USDC.E']);
const AMOUNT_TOLERANCE = 0.05;
const TIME_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function normHash(hash: string | undefined): string {
  return (hash ?? '').toLowerCase();
}

function isUsdcChainReceive(tx: WalletTx): boolean {
  return (
    tx.source === 'chain'
    && tx.direction === 'in'
    && USDC_SYMBOLS.has(tx.tokenSymbol.toUpperCase())
    && tx.amount > 0
  );
}

function bridgeSettlementAmount(tx: WalletTx): number {
  if (tx.source !== 'fiat_deposit' && tx.source !== 'crypto_deposit') return 0;
  if (tx.amount > 0) return tx.amount;
  return 0;
}

function amountsMatch(a: number, b: number): boolean {
  if (a <= 0 || b <= 0) return false;
  return Math.abs(a - b) <= Math.max(AMOUNT_TOLERANCE, a * 0.01);
}

function bridgeTimestampMs(tx: WalletTx): number {
  const ts = Date.parse(tx.timestamp);
  return Number.isFinite(ts) ? ts : 0;
}

function chainTimestampMs(tx: WalletTx): number {
  const ts = Date.parse(tx.timestamp);
  return Number.isFinite(ts) ? ts : 0;
}

function withinBridgeWindow(bridge: WalletTx, chain: WalletTx): boolean {
  const bridgeTs = bridgeTimestampMs(bridge);
  const chainTs = chainTimestampMs(chain);
  if (bridgeTs <= 0 || chainTs <= 0) return true;
  return chainTs >= bridgeTs - 60_000 && chainTs - bridgeTs <= TIME_WINDOW_MS;
}

function collectBridgeHashes(bridge: WalletTx): string[] {
  const hashes: string[] = [];
  if (bridge.hash) hashes.push(normHash(bridge.hash));
  return hashes.filter(Boolean);
}

function mergeChainSettlement(bridge: WalletTx, chain: WalletTx): WalletTx {
  const merged: WalletTx = { ...bridge };
  const hashMatch =
    normHash(bridge.hash) !== ''
    && normHash(bridge.hash) === normHash(chain.hash);

  if (!merged.hash && chain.hash) merged.hash = chain.hash;

  const bridgeAmount = bridgeSettlementAmount(bridge);
  if (chain.amount > 0) {
    if (
      bridgeAmount <= 0
      || amountsMatch(bridgeAmount, chain.amount)
      || hashMatch
    ) {
      merged.amount = chain.amount;
      merged.rawValue = chain.rawValue;
    }
  }

  if (!merged.statusPending && merged.source === 'fiat_deposit') {
    merged.statusLabelKey = merged.statusLabelKey ?? 'card.statusCompleted';
    merged.statusColor = merged.statusColor ?? '#10B981';
  }
  return merged;
}

function findChainMatch(bridge: WalletTx, chains: WalletTx[]): WalletTx | null {
  const hashes = collectBridgeHashes(bridge);
  if (hashes.length > 0) {
    for (const chain of chains) {
      const chainHash = normHash(chain.hash);
      if (chainHash && hashes.includes(chainHash)) return chain;
    }
  }

  const targetAmount = bridgeSettlementAmount(bridge);
  if (targetAmount > 0) {
    for (const chain of chains) {
      if (!isUsdcChainReceive(chain)) continue;
      if (!withinBridgeWindow(bridge, chain)) continue;
      if (amountsMatch(chain.amount, targetAmount)) return chain;
    }
  }

  if (bridge.source === 'fiat_deposit' && !bridge.statusPending && bridgeSettlementAmount(bridge) <= 0) {
    const candidates = chains.filter(
      (chain) => isUsdcChainReceive(chain) && withinBridgeWindow(bridge, chain),
    );
    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1) {
      const bridgeTs = bridgeTimestampMs(bridge);
      return candidates.reduce((best, chain) => {
        const bestDelta = Math.abs(chainTimestampMs(best) - bridgeTs);
        const chainDelta = Math.abs(chainTimestampMs(chain) - bridgeTs);
        return chainDelta < bestDelta ? chain : best;
      });
    }
  }

  return null;
}

/**
 * Hide on-chain USDC settlements that belong to a Bridge deposit row and
 * enrich the Bridge row with hash / credited amount from chain when missing.
 */
export function reconcileBridgeAndChainTxs(txs: WalletTx[]): WalletTx[] {
  const bridgeRows = txs.filter(
    (tx) => tx.source === 'fiat_deposit' || tx.source === 'crypto_deposit',
  );
  const chainRows = txs.filter((tx) => tx.source === 'chain');
  const otherRows = txs.filter(
    (tx) => tx.source !== 'chain' && tx.source !== 'fiat_deposit' && tx.source !== 'crypto_deposit',
  );

  if (bridgeRows.length === 0) return txs;

  const matchedChainIds = new Set<string>();
  const reconciledBridge = bridgeRows.map((bridge) => {
    const availableChains = chainRows.filter((chain) => !matchedChainIds.has(chain.id));
    const match = findChainMatch(bridge, availableChains);
    if (!match) return bridge;
    matchedChainIds.add(match.id);
    return mergeChainSettlement(bridge, match);
  });

  const remainingChains = chainRows.filter((chain) => !matchedChainIds.has(chain.id));

  return [...otherRows, ...reconciledBridge, ...remainingChains].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

/** @deprecated Use reconcileBridgeAndChainTxs */
export function suppressBridgeDuplicateChainTxs(txs: WalletTx[]): WalletTx[] {
  return reconcileBridgeAndChainTxs(txs);
}
