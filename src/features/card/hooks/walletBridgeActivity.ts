/**
 * Normalizes Bridge fiat / crypto deposit activity into WalletTx rows
 * for the unified transaction history feed.
 */

import { hasKuraBackend } from '../../../config/env';
import { readAuthToken } from '../../../lib/api/client';
import {
  isCryptoTransferComplete,
  isCryptoTransferTerminal,
  isOnrampTransferComplete,
  isOnrampTransferTerminal,
  isPayoutDrainComplete,
  isPayoutDrainTerminal,
  listAccountDeposits,
  listCryptoTransfers,
  listDeposits,
  listOnRampAccounts,
  listOnrampTransfers,
  listExternalAccounts,
  listPayoutAddresses,
  listPayoutDrains,
  listTransfers,
  payoutDrainReferenceId,
  type DepositResult,
  type ExternalAccountResult,
  type PayoutAddressResult,
  type PayoutDrainResult,
  type TransferResult,
  type VirtualAccount,
} from '../../../lib/api/ramp/client';
import Logger from '../../../shared/utils/Logger';
import { hasPendingBridgeDeposits } from '../../../lib/api/ramp/bridgeDepositDisplay';
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

const PAYOUT_DRAIN_STATUS: Record<string, { labelKey: string; color: string }> = {
  in_review: { labelKey: 'card.statusInReview', color: '#FBBF24' },
  funds_received: { labelKey: 'card.statusConverting', color: '#FBBF24' },
  payment_submitted: { labelKey: 'card.statusOnItsWay', color: '#60A5FA' },
  payment_processed: { labelKey: 'card.statusCompleted', color: '#10B981' },
  undeliverable: { labelKey: 'card.payoutStatusUndeliverable', color: '#EF4444' },
  returned: { labelKey: 'card.cryptoStatusReturned', color: '#EF4444' },
  refunded: { labelKey: 'card.statusRefunded', color: '#EF4444' },
  error: { labelKey: 'card.cryptoStatusFailed', color: '#EF4444' },
  canceled: { labelKey: 'card.cryptoStatusFailed', color: '#EF4444' },
};

export interface BridgeActivitiesResult {
  txs: WalletTx[];
  depositCount: number;
  hasVirtualAccounts: boolean;
  /** True when any deposit is funds_received and not completed (see bridgePollConfig). */
  hasPendingFundsReceived: boolean;
  /** True when any payout drain is in_review / funds_received / payment_submitted. */
  hasPendingPayoutDrains: boolean;
  payoutAddresses: PayoutAddressResult[];
  externalAccounts: ExternalAccountResult[];
}

function parseAmount(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

function resolveBridgeStatus(state: string): { labelKey: string; color: string } | undefined {
  return DEPOSIT_STATUS[state] ?? CRYPTO_TRANSFER_STATUS[state];
}

function resolvePayoutDrainStatus(state: string): { labelKey: string; color: string } | undefined {
  return PAYOUT_DRAIN_STATUS[state] ?? DEPOSIT_STATUS[state];
}

function resolvePayoutDrainId(drain: PayoutDrainResult, payoutAddress: PayoutAddressResult): string {
  const ref = payoutDrainReferenceId(drain);
  return `fiat-withdraw-${payoutAddress.bridgeLiquidationAddressId}:${ref}`;
}

function resolvePayoutDrainAmounts(drain: PayoutDrainResult): {
  usdcAmount: number;
  fiatAmount?: number;
  fiatCurrency?: string;
} {
  const parsed = parseAmount(drain.amount);
  const currency = (drain.currency ?? 'usdc').toLowerCase();
  if (currency === 'usdc' || currency === 'usdbc' || currency === 'usdc.e') {
    // Tiny values are usually gas legs or fees miscategorized as USDC — prefer chain reconciliation.
    return { usdcAmount: parsed >= 1 ? parsed : 0 };
  }
  const fiatCurrency = (drain.destination?.currency ?? currency).toUpperCase();
  return {
    usdcAmount: 0,
    fiatAmount: parsed > 0 ? parsed : undefined,
    fiatCurrency,
  };
}

export function normalizePayoutDrain(
  drain: PayoutDrainResult,
  payoutAddress: PayoutAddressResult,
): WalletTx {
  const statusMeta = resolvePayoutDrainStatus(drain.state);
  const { usdcAmount, fiatAmount, fiatCurrency } = resolvePayoutDrainAmounts(drain);
  const complete = isPayoutDrainComplete(drain);
  const terminal = isPayoutDrainTerminal(drain);
  const destinationRail = drain.destination?.payment_rail ?? payoutAddress.destinationRail;
  const destinationCurrency =
    drain.destination?.currency ?? payoutAddress.destinationCurrency;

  return {
    id: resolvePayoutDrainId(drain, payoutAddress),
    source: 'fiat_withdraw',
    hash: drain.depositTxHash ?? '',
    timestamp: drain.createdAt,
    direction: 'out',
    counterparty: (destinationCurrency ?? 'usd').toUpperCase(),
    counterpartyName: null,
    tokenSymbol: 'USDC',
    tokenDecimals: 6,
    tokenIconUrl: null,
    amount: usdcAmount,
    rawValue: usdcAmount > 0 ? String(usdcAmount) : '0',
    statusLabelKey: statusMeta?.labelKey,
    statusColor: statusMeta?.color ?? '#9CA3AF',
    statusPending: !complete && !terminal,
    bridgeReferenceId: payoutDrainReferenceId(drain),
    destinationRail,
    destinationCurrency,
    toAddress: payoutAddress.depositAddress,
    updatedAt: drain.updatedAt,
    accountLast4: drain.destination?.last4 ?? undefined,
    sourceFiatAmount: fiatAmount,
    sourceFiatCurrency: fiatAmount != null ? fiatCurrency : undefined,
    grossAmountLabel:
      fiatAmount != null && fiatCurrency
        ? `${fiatAmount} ${fiatCurrency}`
        : undefined,
  };
}

/** Attach bank account last4 from saved external accounts via payout LA mapping. */
export function enrichFiatWithdrawAccountMeta(
  txs: WalletTx[],
  payoutAddresses: PayoutAddressResult[],
  externalAccounts: ExternalAccountResult[],
): WalletTx[] {
  if (payoutAddresses.length === 0) return txs;

  const accountById = new Map(
    externalAccounts.map((account) => [account.bridgeExternalAccountId, account]),
  );
  const payoutByDeposit = new Map(
    payoutAddresses.map((address) => [address.depositAddress.toLowerCase(), address]),
  );

  return txs.map((tx) => {
    if (tx.source !== 'fiat_withdraw') return tx;

    const payout = payoutByDeposit.get((tx.toAddress ?? '').toLowerCase());
    const account = payout ? accountById.get(payout.bridgeExternalAccountId) : undefined;

    const accountLast4 = tx.accountLast4 ?? account?.last4 ?? undefined;
    const counterpartyName = tx.counterpartyName ?? account?.accountOwnerName ?? null;

    if (!accountLast4 && !counterpartyName) return tx;

    return {
      ...tx,
      accountLast4,
      counterpartyName,
    };
  });
}

async function fetchAllPayoutDrains(
  payoutAddresses: PayoutAddressResult[],
): Promise<WalletTx[]> {
  if (payoutAddresses.length === 0) return [];

  const batches = await Promise.all(
    payoutAddresses.map(async (address) => {
      try {
        const drains = await listPayoutDrains(address.bridgeLiquidationAddressId);
        return drains.map((drain) => normalizePayoutDrain(drain, address));
      } catch (error) {
        Logger.warn('BridgeActivity', 'listPayoutDrains failed', {
          liquidationAddressId: address.bridgeLiquidationAddressId,
          error: error instanceof Error ? error.message : String(error),
        });
        return [] as WalletTx[];
      }
    }),
  );

  return batches.flat().sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

export function hasPendingPayoutDrainTxs(txs: WalletTx[]): boolean {
  return txs.some(
    (tx) => tx.source === 'fiat_withdraw' && tx.statusPending,
  );
}

function resolveDepositSettlementHash(d: DepositResult): string | null {
  if (d.destinationTxHash) return d.destinationTxHash;
  if (!d.events?.length) return null;
  for (let i = d.events.length - 1; i >= 0; i--) {
    const hash = d.events[i]?.destinationTxHash;
    if (hash) return hash;
  }
  return null;
}

function resolveDepositAmounts(d: DepositResult): {
  grossSource: number;
  net: number;
  sourceCurrency: string;
} {
  const sourceCurrency = (d.currency ?? 'usd').toUpperCase();
  let grossSource = parseAmount(d.amount);
  let net = parseAmount(d.netAmount);

  if (grossSource === 0 && d.events?.length) {
    for (let i = d.events.length - 1; i >= 0; i--) {
      const amount = parseAmount(d.events[i]?.amount);
      if (amount > 0) {
        grossSource = amount;
        break;
      }
    }
  }

  if (net === 0 && d.events?.length) {
    for (let i = d.events.length - 1; i >= 0; i--) {
      const event = d.events[i];
      if (event?.type === 'payment_processed' || event?.destinationTxHash) {
        const eventNet = parseAmount(event.amount);
        if (eventNet > 0 && (grossSource === 0 || eventNet < grossSource)) {
          net = eventNet;
        }
      }
    }
  }

  return { grossSource, net, sourceCurrency };
}

function resolveFiatAmounts(
  sourceCurrency: string,
  grossSource: number,
  net: number,
): { usdAmount: number; sourceFiat: number } {
  const isUsdSource = sourceCurrency === 'USD';
  let usdAmount = 0;
  let sourceFiat = grossSource;

  if (isUsdSource) {
    usdAmount = net || grossSource;
  } else if (net > 0 && grossSource > 0 && net < grossSource * 0.5) {
    usdAmount = net;
  } else if (grossSource === 0 && net > 0) {
    sourceFiat = net;
  } else if (net > 0) {
    // Non-USD: netAmount is credited USDC once conversion completes.
    usdAmount = net;
  }

  return { usdAmount, sourceFiat };
}

function buildFiatDepositTx(
  id: string,
  referenceId: string,
  opts: {
    status: string;
    completed: boolean;
    sourceCurrency: string;
    grossSource: number;
    net: number;
    grossAmountLabel?: string;
    hash?: string | null;
    timestamp: string;
    updatedAt?: string;
    exchangeFee?: string | null;
    developerFee?: string | null;
    gasFee?: string | null;
    paymentRail?: string;
    senderName?: string;
    accountLast4?: string;
    senderBankRoutingNumber?: string;
    senderDescription?: string;
  },
): WalletTx {
  const statusMeta = resolveBridgeStatus(opts.status);
  const { usdAmount, sourceFiat } = resolveFiatAmounts(
    opts.sourceCurrency,
    opts.grossSource,
    opts.net,
  );
  const grossLabel =
    opts.grossAmountLabel
    ?? (opts.grossSource > 0 ? `${opts.grossSource} ${opts.sourceCurrency}` : undefined);

  return {
    id,
    source: 'fiat_deposit',
    hash: opts.hash ?? '',
    timestamp: opts.timestamp,
    direction: 'in',
    counterparty: opts.sourceCurrency,
    counterpartyName: null,
    tokenSymbol: 'USDC',
    tokenDecimals: 6,
    tokenIconUrl: null,
    amount: usdAmount,
    rawValue: opts.net > 0 ? String(opts.net) : String(opts.grossSource || 0),
    statusLabelKey: statusMeta?.labelKey,
    statusColor: statusMeta?.color ?? '#9CA3AF',
    statusPending: !opts.completed,
    bridgeReferenceId: referenceId,
    sourceFiatAmount: sourceFiat > 0 ? sourceFiat : undefined,
    sourceFiatCurrency: sourceFiat > 0 ? opts.sourceCurrency : undefined,
    grossAmountLabel: grossLabel,
    exchangeFee: opts.exchangeFee,
    developerFee: opts.developerFee,
    gasFee: opts.gasFee,
    updatedAt: opts.updatedAt,
    paymentRail: opts.paymentRail,
    senderName: opts.senderName,
    accountLast4: opts.accountLast4,
    senderBankRoutingNumber: opts.senderBankRoutingNumber,
    senderDescription: opts.senderDescription,
  };
}

export function normalizeFiatDeposit(d: DepositResult): WalletTx {
  const { grossSource, net, sourceCurrency } = resolveDepositAmounts(d);
  const referenceId = d.depositId ?? `${d.bridgeVirtualAccountId}:${d.createdAt}`;
  return buildFiatDepositTx(`fiat-deposit-${referenceId}`, referenceId, {
    status: d.status,
    completed: d.completed,
    sourceCurrency,
    grossSource,
    net,
    grossAmountLabel: d.amount ? `${d.amount} ${sourceCurrency}` : undefined,
    hash: resolveDepositSettlementHash(d),
    timestamp: d.createdAt,
    updatedAt: d.updatedAt,
    exchangeFee: d.exchangeFeeAmount,
    developerFee: d.developerFeeAmount,
    gasFee: d.gasFee,
    paymentRail: d.paymentRail ?? undefined,
    senderName: d.senderName ?? undefined,
    accountLast4: d.accountLast4 ?? undefined,
    senderBankRoutingNumber: d.senderBankRoutingNumber ?? undefined,
    senderDescription: d.senderDescription ?? undefined,
  });
}

export function normalizeOnrampTransfer(t: TransferResult): WalletTx {
  const sourceCurrency = (t.sourceCurrency ?? 'usd').toUpperCase();
  const grossSource = parseAmount(t.amount);
  const complete = isOnrampTransferComplete(t);

  return buildFiatDepositTx(`onramp-transfer-${t.bridgeTransferId}`, t.bridgeTransferId, {
    status: t.state,
    completed: complete,
    sourceCurrency,
    grossSource,
    net: 0,
    timestamp: t.createdAt,
  });
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

function isOnrampTransferRedundant(
  transfer: TransferResult,
  deposits: DepositResult[],
): boolean {
  const tAmount = parseAmount(transfer.amount);
  const tCurrency = (transfer.sourceCurrency ?? '').toLowerCase();
  const tTime = Date.parse(transfer.createdAt);
  if (!Number.isFinite(tTime)) return false;

  return deposits.some((deposit) => {
    const dCurrency = (deposit.currency ?? '').toLowerCase();
    if (dCurrency !== tCurrency) return false;

    const { grossSource } = resolveDepositAmounts(deposit);
    if (Math.abs(grossSource - tAmount) >= 0.01) return false;

    const dTime = Date.parse(deposit.createdAt);
    if (!Number.isFinite(dTime)) return false;
    return Math.abs(dTime - tTime) <= 5 * 60 * 1000;
  });
}

async function fetchAllBridgeDeposits(
  options?: { force?: boolean },
  onRampAccounts?: VirtualAccount[],
): Promise<DepositResult[]> {
  const byId = new Map<string, DepositResult>();

  const addAll = (items: DepositResult[]) => {
    for (const item of items) {
      const key = item.depositId ?? `${item.bridgeVirtualAccountId}:${item.createdAt}`;
      if (key) byId.set(key, item);
    }
  };

  const global = await listDeposits(options);
  addAll(global);

  try {
    const accounts = onRampAccounts ?? (await listOnRampAccounts());
    if (accounts.length > 0) {
      const perVa = await Promise.all(
        accounts.map((va) =>
          listAccountDeposits(va.bridgeVirtualAccountId, options).catch((error) => {
            Logger.warn('BridgeActivity', 'listAccountDeposits failed', {
              virtualAccountId: va.bridgeVirtualAccountId,
              error: error instanceof Error ? error.message : String(error),
            });
            return [] as DepositResult[];
          }),
        ),
      );
      for (const batch of perVa) addAll(batch);
    }
  } catch (error) {
    Logger.warn('BridgeActivity', 'listOnRampAccounts failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return Array.from(byId.values()).sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

export async function fetchBridgeActivities(options?: {
  force?: boolean;
}): Promise<BridgeActivitiesResult> {
  const empty: BridgeActivitiesResult = {
    txs: [],
    depositCount: 0,
    hasVirtualAccounts: false,
    hasPendingFundsReceived: false,
    hasPendingPayoutDrains: false,
    payoutAddresses: [],
    externalAccounts: [],
  };

  if (!hasKuraBackend()) return empty;

  const token = await readAuthToken();
  if (!token) return empty;

  let onRampAccounts: VirtualAccount[] = [];
  try {
    onRampAccounts = await listOnRampAccounts();
  } catch {
    // Best-effort — deposit fetch still runs.
  }
  const hasVirtualAccounts = onRampAccounts.length > 0;

  let payoutAddresses: PayoutAddressResult[] = [];
  try {
    payoutAddresses = await listPayoutAddresses();
  } catch (error) {
    Logger.warn('BridgeActivity', 'listPayoutAddresses failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  let externalAccounts: ExternalAccountResult[] = [];
  try {
    externalAccounts = await listExternalAccounts();
  } catch (error) {
    Logger.warn('BridgeActivity', 'listExternalAccounts failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const [deposits, transfers, payoutTxs] = await Promise.all([
    fetchAllBridgeDeposits(options, onRampAccounts).catch((error) => {
      Logger.warn('BridgeActivity', 'fetchAllBridgeDeposits failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [] as DepositResult[];
    }),
    listTransfers().catch((error) => {
      Logger.warn('BridgeActivity', 'listTransfers failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [] as TransferResult[];
    }),
    fetchAllPayoutDrains(payoutAddresses),
  ]);

  Logger.info('BridgeActivity', 'Deposits loaded', {
    depositCount: deposits.length,
    hasVirtualAccounts,
    pendingCount: deposits.filter((d) => !d.completed).length,
  });

  const depositTxs = deposits.map(normalizeFiatDeposit);
  const onrampTxs = listOnrampTransfers(transfers)
    .filter((transfer) => !isOnrampTransferRedundant(transfer, deposits))
    .map(normalizeOnrampTransfer);
  const cryptoTxs = listCryptoTransfers(transfers).map(normalizeCryptoTransfer);

  const enrichedPayoutTxs = enrichFiatWithdrawAccountMeta(
    payoutTxs,
    payoutAddresses,
    externalAccounts,
  );

  const hasPendingPayoutDrains = enrichedPayoutTxs.some((tx) => tx.statusPending);

  return {
    txs: [...depositTxs, ...onrampTxs, ...cryptoTxs, ...enrichedPayoutTxs],
    depositCount: deposits.length,
    hasVirtualAccounts,
    hasPendingFundsReceived: hasPendingBridgeDeposits(deposits),
    hasPendingPayoutDrains,
    payoutAddresses,
    externalAccounts,
  };
}

export function hasPendingBridgeActivity(txs: WalletTx[]): boolean {
  return txs.some((tx) => tx.statusPending);
}
