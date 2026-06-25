/**
 * useWalletHistory
 *
 * Fetches ERC-20 token transfer history for the Card Smart Account from Blockscout
 * (Base mainnet, no API key required).
 *
 * Uses the stable Etherscan-compatible v1 endpoint:
 *   GET https://base.blockscout.com/api?module=account&action=tokentx&address={addr}
 * (The richer /api/v2 endpoint has periodic outages — it was returning HTTP 500
 * across all routes — whereas this v1 route stays up, so we rely on it instead.)
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import i18n from '../../../shared/locales/i18n';
import { fetchBridgeActivities, hasPendingBridgeActivity } from './walletBridgeActivity';
import { filterWalletTxsForDisplay } from '../utils/walletTxFilter';

const BLOCKSCOUT_API = 'https://base.blockscout.com/api';
const PAGE_SIZE = 20;
/** Blockscout is occasionally flaky; retry transient failures a few times. */
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 600;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Message returned when an address genuinely has no transfers (not an error). */
function isEmptyResultMessage(message: string): boolean {
  return /no\s+(token\s+)?transactions?\s+found/i.test(message);
}

// ─────────────────────────────────────────────────────────────────────────────
// Types matching Blockscout v1 (Etherscan-compatible) schema
// ─────────────────────────────────────────────────────────────────────────────

interface BlockscoutV1Transfer {
  hash: string;
  /** Unix timestamp in seconds (string). */
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  tokenSymbol: string | null;
  tokenName: string | null;
  tokenDecimal: string | null;
  contractAddress: string;
}

interface BlockscoutV1Response {
  status?: string;
  message: string;
  /** Array of transfers on success, or an error string when none/failed. */
  result: BlockscoutV1Transfer[] | string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalised tx
// ─────────────────────────────────────────────────────────────────────────────

export type TxDirection = 'in' | 'out' | 'self';

export type WalletActivitySource = 'chain' | 'fiat_deposit' | 'crypto_deposit';

export interface WalletTx {
  /** Stable row id (hash + token contract + from + to + value, or bridge id). */
  id: string;
  source: WalletActivitySource;
  hash: string;
  timestamp: string;
  direction: TxDirection;
  /** counter-party address */
  counterparty: string;
  counterpartyName: string | null;
  tokenSymbol: string;
  tokenDecimals: number;
  tokenIconUrl: string | null;
  /** human-readable amount */
  amount: number;
  rawValue: string;
  /** Bridge deposit / transfer status (shown instead of counterparty address). */
  statusLabelKey?: string;
  statusColor?: string;
  statusPending?: boolean;
  fromAddress?: string;
  toAddress?: string;
  tokenContract?: string;
  bridgeReferenceId?: string;
  grossAmountLabel?: string;
  exchangeFee?: string | null;
  developerFee?: string | null;
  gasFee?: string | null;
  updatedAt?: string;
  destinationRail?: string | null;
  destinationCurrency?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function txId(transfer: BlockscoutV1Transfer): string {
  return [
    transfer.hash,
    (transfer.contractAddress ?? '').toLowerCase(),
    (transfer.from ?? '').toLowerCase(),
    (transfer.to ?? '').toLowerCase(),
    transfer.value ?? '0',
  ].join('-');
}

function normalize(
  transfer: BlockscoutV1Transfer,
  smartAddress: string,
): WalletTx {
  const myAddr = smartAddress.toLowerCase();
  const fromAddr = (transfer.from ?? '').toLowerCase();
  const toAddr = (transfer.to ?? '').toLowerCase();

  let direction: TxDirection;
  let counterparty: string;
  let counterpartyName: string | null;

  if (fromAddr === myAddr && toAddr === myAddr) {
    direction = 'self';
    counterparty = transfer.from;
    counterpartyName = i18n.t('card.self');
  } else if (fromAddr === myAddr) {
    direction = 'out';
    counterparty = transfer.to;
    counterpartyName = null;
  } else {
    direction = 'in';
    counterparty = transfer.from;
    counterpartyName = null;
  }

  const decimals = transfer.tokenDecimal
    ? parseInt(transfer.tokenDecimal, 10)
    : 18;

  const rawValue = transfer.value ?? '0';
  const amount = parseFloat(rawValue) / Math.pow(10, decimals);

  // v1 returns a Unix timestamp in seconds; convert to ISO for the formatter.
  const tsSeconds = parseInt(transfer.timeStamp ?? '', 10);
  const timestamp = Number.isFinite(tsSeconds)
    ? new Date(tsSeconds * 1000).toISOString()
    : new Date().toISOString();

  return {
    id: txId(transfer),
    source: 'chain',
    hash: transfer.hash,
    timestamp,
    direction,
    counterparty,
    counterpartyName,
    tokenSymbol: transfer.tokenSymbol ?? 'TOKEN',
    tokenDecimals: decimals,
    tokenIconUrl: null,
    amount,
    rawValue,
    fromAddress: transfer.from,
    toAddress: transfer.to,
    tokenContract: transfer.contractAddress,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export interface UseWalletHistoryReturn {
  txs: WalletTx[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}

export function useWalletHistory(smartAddress: string): UseWalletHistoryReturn {
  const [chainTxs, setChainTxs] = useState<WalletTx[]>([]);
  const [bridgeTxs, setBridgeTxs] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const mountedRef = useRef(true);

  const txs = useMemo(() => {
    const seen = new Set<string>();
    const merged = [...chainTxs, ...bridgeTxs]
      .filter((tx) => {
        if (seen.has(tx.id)) return false;
        seen.add(tx.id);
        return true;
      })
      .sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
    return filterWalletTxsForDisplay(merged);
  }, [chainTxs, bridgeTxs]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchBridge = useCallback(async () => {
    try {
      const items = await fetchBridgeActivities();
      if (mountedRef.current) setBridgeTxs(items);
    } catch {
      // Bridge history is best-effort; on-chain history still shows.
    }
  }, []);

  const fetchPage = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!smartAddress) return;
      if (!mountedRef.current) return;

      setLoading(true);
      if (!append) setError(null);

      const qs = new URLSearchParams({
        module: 'account',
        action: 'tokentx',
        address: smartAddress,
        page: String(pageNum),
        offset: String(PAGE_SIZE),
        sort: 'desc',
      });
      const url = `${BLOCKSCOUT_API}?${qs.toString()}`;

      try {
        let items: BlockscoutV1Transfer[] | null = null;
        let lastErr = '';

        // Retry transient Blockscout failures (HTTP 5xx / "Something went wrong").
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
          if (attempt > 0) await sleep(RETRY_DELAY_MS);
          try {
            const res = await fetch(url, { headers: { Accept: 'application/json' } });
            if (!res.ok) {
              lastErr = `Blockscout error ${res.status}`;
              continue;
            }
            const data = (await res.json()) as BlockscoutV1Response;
            if (Array.isArray(data.result)) {
              items = data.result;
              break;
            }
            // Non-array result: genuinely empty vs. a transient server error.
            if (isEmptyResultMessage(data.message ?? '')) {
              items = [];
              break;
            }
            lastErr = data.message || 'Blockscout error';
          } catch (e) {
            lastErr = e instanceof Error ? e.message : String(e);
          }
        }

        if (!mountedRef.current) return;
        if (items === null) throw new Error(lastErr || i18n.t('card.failedLoadHistory'));

        const normalized = items.map((item) => normalize(item, smartAddress));
        setChainTxs((prev) => {
          if (!append) return normalized;
          const seen = new Set(prev.map((tx) => tx.id));
          const next = normalized.filter((tx) => !seen.has(tx.id));
          return [...prev, ...next];
        });
        setPage(pageNum);
        setHasMore(items.length >= PAGE_SIZE);
      } catch (err) {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err.message : i18n.t('card.failedLoadHistory'));
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [smartAddress],
  );

  const refresh = useCallback(() => {
    setChainTxs([]);
    setBridgeTxs([]);
    setPage(1);
    setHasMore(false);
    void fetchBridge();
    fetchPage(1, false);
  }, [fetchBridge, fetchPage]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchPage(page + 1, true);
    }
  }, [loading, hasMore, page, fetchPage]);

  // Auto-load on address change
  useEffect(() => {
    if (smartAddress) {
      setChainTxs([]);
      setBridgeTxs([]);
      setPage(1);
      setHasMore(false);
      void fetchBridge();
      fetchPage(1, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smartAddress]);

  // Poll Bridge deposits while any are still in flight.
  useEffect(() => {
    if (!hasPendingBridgeActivity(bridgeTxs)) return;
    const id = setInterval(() => void fetchBridge(), 12000);
    return () => clearInterval(id);
  }, [bridgeTxs, fetchBridge]);

  return { txs, loading, error, hasMore, loadMore, refresh };
}
