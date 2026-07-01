/**
 * useWalletHistory
 *
 * Fetches ERC-20 token transfer history for the Card Smart Account from Blockscout
 * (Base mainnet, no API key required).
 *
 * Uses the stable Etherscan-compatible v1 endpoint:
 *   GET https://base.blockscout.com/api?module=account&action=tokentx&address={addr}
 *
 * History is backed by a shared session store per smart address so Home preview and
 * All Transactions reuse one Blockscout pager + Bridge poll.
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useAppStore } from '../../../shared/store/useAppStore';
import {
  getWalletHistorySnapshot,
  notifyWalletHistoryAuthChanged,
  subscribeWalletHistory,
  type WalletHistoryPublicSnapshot,
} from './walletHistoryStore';

export { resetWalletHistorySession } from './walletHistoryStore';
// ─────────────────────────────────────────────────────────────────────────────

export type TxDirection = 'in' | 'out' | 'self';

export type WalletActivitySource = 'chain' | 'fiat_deposit' | 'crypto_deposit' | 'fiat_withdraw';

export type WalletActivityKind = import('../utils/walletTxEnrichment').WalletActivityKind;

export interface WalletTx {
  id: string;
  source: WalletActivitySource;
  hash: string;
  timestamp: string;
  direction: TxDirection;
  counterparty: string;
  counterpartyName: string | null;
  tokenSymbol: string;
  tokenDecimals: number;
  tokenIconUrl: string | null;
  amount: number;
  rawValue: string;
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
  sourceFiatAmount?: number;
  sourceFiatCurrency?: string;
  paymentRail?: string;
  senderName?: string;
  accountLast4?: string;
  senderBankRoutingNumber?: string;
  senderDescription?: string;
  activityKind?: WalletActivityKind;
  activitySubkind?: 'earn' | 'borrow_collateral';
  activityDetailKey?: string;
  activityDetailParams?: Record<string, string>;
  swapFromSymbol?: string;
  swapToSymbol?: string;
}

/** Default history window for All Transactions before manual load-more. */
export const DEFAULT_TX_HISTORY_WINDOW_DAYS = 30;

export interface UseWalletHistoryOptions {
  /** Auto-fetch pages until this many days of on-chain history are loaded. */
  initialWindowDays?: number;
}

export type UseWalletHistoryReturn = WalletHistoryPublicSnapshot;

export function useWalletHistory(
  smartAddress: string,
  options?: UseWalletHistoryOptions,
): UseWalletHistoryReturn {
  const initialWindowDays = options?.initialWindowDays ?? 0;
  const authToken = useAppStore((state) => state.authToken);

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      subscribeWalletHistory(smartAddress, initialWindowDays, onStoreChange),
    [smartAddress, initialWindowDays],
  );

  const getSnapshot = useCallback(
    () => getWalletHistorySnapshot(smartAddress, initialWindowDays),
    [smartAddress, initialWindowDays],
  );

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    notifyWalletHistoryAuthChanged();
  }, [authToken]);

  return snapshot;
}
