/**
 * Normalizes Bridge fiat / crypto deposit activity into WalletTx rows
 * for the unified transaction history feed.
 */

import { hasKuraBackend } from '../../../config/env';
import {
  isCryptoTransferComplete,
  isCryptoTransferTerminal,
  listCryptoTransfers,
  listDeposits,
  listTransfers,
  type DepositResult,
  type TransferResult,
} from '../../../lib/api/ramp/client';
import type { WalletTx } from './useWalletHistory';

const DEPOSIT_STATUS: Record<string, { labelKey: string; color: string }> = {
  funds_scheduled: { labelKey: 'card.statusScheduled', color: '#9CA3AF' },
  funds_received: { labelKey: 'card.statusConverting', color: '#FBBF24' },
  in_review: { labelKey: 'card.statusInReview', color: '#FBBF24' },
  payment_submitted: { labelKey: 'card.statusOnItsWay', color: '#60A5FA' },
  payment_processed: { labelKey: 'card.statusCompleted', color: '#10B981' },
  refunded: { labelKey: 'card.statusRefunded', color: '#EF4444' },
};

const CRYPTO_TRANSFER_STATUS: Record<string, { labelKey: string; color: string }> = {
  awaiting_funds: { labelKey: 'card.cryptoStatusAwaitingFunds', color: '#9CA3AF' },
  funds_received: { labelKey: 'card.cryptoStatusFundsReceived', color: '#FBBF24' },
  payment_submitted: { labelKey: 'card.cryptoStatusConverting', color: '#60A5FA' },
  payment_processed: { labelKey: 'card.statusCompleted', color: '#10B981' },
  returned: { labelKey: 'card.cryptoStatusReturned', color: '#EF4444' },
  refunded: { labelKey: 'card.statusRefunded', color: '#EF4444' },
  error: { labelKey: 'card.cryptoStatusFailed', color: '#EF4444' },
  canceled: { labelKey: 'card.cryptoStatusFailed', color: '#EF4444' },
};

function parseAmount(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeFiatDeposit(d: DepositResult): WalletTx {
  const statusMeta = DEPOSIT_STATUS[d.status];
  const amountRaw = d.netAmount ?? d.amount;
  const currency = (d.currency ?? 'usd').toUpperCase();

  return {
    id: `fiat-deposit-${d.depositId}`,
    source: 'fiat_deposit',
    hash: d.destinationTxHash ?? '',
    timestamp: d.createdAt,
    direction: 'in',
    counterparty: currency,
    counterpartyName: null,
    tokenSymbol: currency,
    tokenDecimals: 2,
    tokenIconUrl: null,
    amount: parseAmount(amountRaw),
    rawValue: amountRaw ?? '0',
    statusLabelKey: statusMeta?.labelKey,
    statusColor: statusMeta?.color ?? '#9CA3AF',
    statusPending: !d.completed,
    bridgeReferenceId: d.depositId,
    grossAmountLabel: d.amount ? `${d.amount} ${currency}` : undefined,
    exchangeFee: d.exchangeFeeAmount,
    developerFee: d.developerFeeAmount,
    gasFee: d.gasFee,
    updatedAt: d.updatedAt,
  };
}

export function normalizeCryptoTransfer(t: TransferResult): WalletTx {
  const statusMeta = CRYPTO_TRANSFER_STATUS[t.state];
  const currency = (t.sourceCurrency ?? 'usdt').toUpperCase();
  const complete = isCryptoTransferComplete(t);
  const terminal = isCryptoTransferTerminal(t);

  return {
    id: `crypto-deposit-${t.bridgeTransferId}`,
    source: 'crypto_deposit',
    hash: '',
    timestamp: t.createdAt,
    direction: 'in',
    counterparty: currency,
    counterpartyName: null,
    tokenSymbol: currency,
    tokenDecimals: 6,
    tokenIconUrl: null,
    amount: parseAmount(t.amount),
    rawValue: t.amount ?? '0',
    statusLabelKey: statusMeta?.labelKey,
    statusColor: statusMeta?.color ?? '#9CA3AF',
    statusPending: !complete && !terminal,
    bridgeReferenceId: t.bridgeTransferId,
    destinationRail: t.destinationRail,
    destinationCurrency: t.destinationCurrency,
    toAddress: t.destinationAddress ?? undefined,
  };
}

export async function fetchBridgeActivities(): Promise<WalletTx[]> {
  if (!hasKuraBackend()) return [];

  const [deposits, transfers] = await Promise.all([
    listDeposits().catch(() => [] as DepositResult[]),
    listTransfers().catch(() => [] as TransferResult[]),
  ]);

  const crypto = listCryptoTransfers(transfers);
  return [
    ...deposits.map(normalizeFiatDeposit),
    ...crypto.map(normalizeCryptoTransfer),
  ];
}

export function hasPendingBridgeActivity(txs: WalletTx[]): boolean {
  return txs.some((tx) => tx.statusPending);
}
