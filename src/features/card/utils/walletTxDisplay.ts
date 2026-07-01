import i18n from '../../../shared/locales/i18n';
import {
  formatDepositPayer,
  formatDepositSenderDescription,
} from '../../../lib/api/ramp/bridgeDepositDisplay';
import { usdFromFiatAmount } from '../../../shared/utils/fiatFx';
import { getLiveExchangeRates } from '../../../shared/utils/exchangeRatesReader';
import type { WalletTx } from '../hooks/useWalletHistory';
import type { TxContactLookup } from './walletTxContacts';
import {
  findContactName,
  isKnownRouterAddress,
  resolvePeerAddress,
} from './walletTxContacts';
import { isMorphoBlueAddress, isMorphoEarnVaultAddress, isMorphoEarnShareSymbol } from './walletTxMorpho';
import { isUsdPeggedSymbol } from './walletTxConstants';

export { isUsdPeggedSymbol } from './walletTxConstants';

const TOKEN_INTENT_NAMES: Record<string, string> = {
  ETH: 'Ethereum',
  WETH: 'Ethereum',
  CBETH: 'Ethereum',
  WSTETH: 'Ethereum',
  CBBTC: 'Bitcoin',
  CBDOGE: 'Dogecoin',
  SOL: 'Solana',
  BTC: 'Bitcoin',
  USDC: 'USDC',
  USDT: 'USDT',
  DAI: 'DAI',
  EURC: 'EURC',
  XSGD: 'XSGD',
  AUDD: 'AUDD',
  BRZ: 'BRZ',
  MXNE: 'MXNe',
};

const DEPOSIT_RAIL_LABEL_KEYS: Record<string, string> = {
  ach_push: 'card.depositRailAchPush',
  ach: 'card.depositRailAchPush',
  wire: 'card.depositRailWire',
  sepa: 'card.depositRailSepa',
  faster_payments: 'card.depositRailFasterPayments',
  spei: 'card.depositRailSpei',
  pix: 'card.depositRailPix',
};

export function formatDepositPaymentRail(rail: string | undefined | null): string | null {
  if (!rail?.trim()) return null;
  const normalized = rail.trim().toLowerCase();
  const key = DEPOSIT_RAIL_LABEL_KEYS[normalized];
  if (key) return i18n.t(key);
  return normalized.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatFiatWithdrawRecipientLine(tx: WalletTx): string | undefined {
  if (tx.source !== 'fiat_withdraw') return undefined;
  const parts: string[] = [];
  if (tx.accountLast4) {
    parts.push(i18n.t('card.txDepositAccountLast4', { last4: tx.accountLast4 }));
  }
  const railLabel = formatDepositPaymentRail(tx.destinationRail);
  if (railLabel) parts.push(railLabel);
  else if (tx.destinationCurrency) parts.push(tx.destinationCurrency.toUpperCase());
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

export function formatFiatWithdrawRecipientName(tx: WalletTx): string {
  if (tx.source !== 'fiat_withdraw') return i18n.t('card.txBridgeFiatWithdrawSub');
  return tx.counterpartyName?.trim() || i18n.t('card.txBridgeFiatWithdrawSub');
}

export function formatDepositPayerFromTx(tx: WalletTx): string | null {
  if (tx.source !== 'fiat_deposit') return null;
  return formatDepositPayer({
    paymentRail: tx.paymentRail ?? null,
    senderName: tx.senderName ?? null,
    accountLast4: tx.accountLast4 ?? null,
    senderBankRoutingNumber: tx.senderBankRoutingNumber ?? null,
    senderDescription: tx.senderDescription ?? null,
  });
}

export function formatDepositPayerAccountLine(tx: WalletTx): string | undefined {
  if (tx.source !== 'fiat_deposit') return undefined;
  const payerLine = formatDepositPayerFromTx(tx);
  const description = formatDepositSenderDescription(tx.senderDescription);
  if (payerLine && description) return `${payerLine} · ${description}`;
  return payerLine ?? description ?? undefined;
}

export interface TxSubtitleLines {
  primary: string;
  secondary?: string;
}

export interface AddressDisplay {
  name: string;
  addressLine?: string;
  fullAddress?: string;
}

export interface TxStatusDisplay {
  labelKey: string;
  color: string;
  pending: boolean;
}

export function getTokenIntentName(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (isMorphoEarnShareSymbol(upper)) return i18n.t('card.txSubEarn');
  return TOKEN_INTENT_NAMES[upper] ?? upper;
}

function getBridgeSourceFiat(
  tx: WalletTx,
): { amount: number; currency: string } | null {
  if (tx.source !== 'fiat_deposit') return null;
  if (tx.sourceFiatAmount != null && tx.sourceFiatCurrency) {
    return { amount: tx.sourceFiatAmount, currency: tx.sourceFiatCurrency };
  }
  return null;
}

export function getTxUsdValue(tx: WalletTx): number {
  if (tx.source === 'fiat_deposit') {
    if (tx.amount > 0) return Math.abs(tx.amount);
    const fiat = getBridgeSourceFiat(tx);
    if (fiat) {
      return usdFromFiatAmount(fiat.amount, fiat.currency, getLiveExchangeRates());
    }
    return 0;
  }
  if (tx.source === 'fiat_withdraw') {
    return Math.abs(tx.amount);
  }
  const abs = Math.abs(tx.amount);
  if (isUsdPeggedSymbol(tx.tokenSymbol)) return abs;
  return abs;
}

/** Buy / Sell / Morpho collateral deposit / withdraw of non-stable assets show token qty. */
export function shouldShowTxTokenQuantity(tx: WalletTx): boolean {
  if (tx.source === 'fiat_deposit') {
    const fiat = getBridgeSourceFiat(tx);
    return !!fiat && getTxUsdValue(tx) === 0;
  }
  if (
    (tx.activityKind === 'deposit' || tx.activityKind === 'withdraw')
    && tx.activitySubkind === 'borrow_collateral'
    && !isUsdPeggedSymbol(tx.tokenSymbol)
  ) {
    return true;
  }
  return (tx.activityKind === 'buy' || tx.activityKind === 'sell')
    && !isUsdPeggedSymbol(tx.tokenSymbol);
}

/** Source currency / token used to process a bridge deposit or payout. */
export function formatTxProcessedWith(tx: WalletTx): string {
  const fiat = getBridgeSourceFiat(tx);
  if (fiat) return formatTxTokenAmount(fiat.amount, fiat.currency);
  if (tx.source === 'crypto_deposit' || tx.source === 'fiat_withdraw') {
    return formatTxTokenAmount(tx.amount, tx.tokenSymbol);
  }
  return formatTxTokenAmount(tx.amount, tx.tokenSymbol);
}

export function formatTxListAmount(
  tx: WalletTx,
  formatFiat: (usd: number) => string,
): string {
  const prefix = getTxAmountPrefix(tx);
  if (shouldShowTxTokenQuantity(tx)) {
    const fiat = getBridgeSourceFiat(tx);
    if (fiat) return `${prefix}${formatTxTokenAmount(fiat.amount, fiat.currency)}`;
    return `${prefix}${formatTxTokenAmount(tx.amount, tx.tokenSymbol)}`;
  }
  return `${prefix}${formatFiat(getTxUsdValue(tx))}`;
}

/** Detail Amount row — always base-currency formatted with currency code as unit. */
export function formatTxDetailAmount(
  tx: WalletTx,
  formatFiat: (usd: number) => string,
  currencyCode: string,
): string {
  const prefix = getTxAmountPrefix(tx);
  return `${prefix}${formatFiat(getTxUsdValue(tx))} ${currencyCode}`;
}

export function isExternalAddressDisplay(display: AddressDisplay): boolean {
  return display.name === i18n.t('card.txExternalWalletLabel');
}

export function formatTxTokenAmount(amount: number, symbol: string): string {
  const abs = Math.abs(amount);
  let body: string;
  if (abs === 0) body = '0.00';
  else if (abs < 0.000001) body = abs.toExponential(2);
  else if (abs < 0.01) body = abs.toFixed(6);
  else if (abs < 1000) body = abs.toFixed(abs < 1 ? 4 : 2);
  else body = abs.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return `${body} ${symbol.toUpperCase()}`;
}

export function formatTxAmount(amount: number, symbol: string): string {
  return formatTxTokenAmount(amount, symbol);
}

export function formatTxRelativeTime(isoTimestamp: string): string {
  try {
    const d = new Date(isoTimestamp);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return i18n.t('card.justNow');
    if (diffMin < 60) return i18n.t('card.minutesAgo', { count: diffMin });
    if (diffHour < 24) return i18n.t('card.hoursAgo', { count: diffHour });
    if (diffDay < 7) return i18n.t('card.daysAgo', { count: diffDay });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

export function formatTxFullDate(isoTimestamp: string): string {
  try {
    return new Date(isoTimestamp).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function truncateAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function resolveAddressDisplay(
  address: string | undefined,
  contacts: TxContactLookup[],
  smartAddress?: string,
): AddressDisplay | null {
  if (!address) return null;

  if (smartAddress && address.toLowerCase() === smartAddress.toLowerCase()) {
    return { name: i18n.t('card.txYourAccount'), fullAddress: address };
  }

  if (isKnownRouterAddress(address)) {
    if (isMorphoBlueAddress(address)) {
      return { name: i18n.t('card.txRouterMorpho'), fullAddress: address };
    }
    if (isMorphoEarnVaultAddress(address)) {
      return { name: i18n.t('card.txSubEarn'), fullAddress: address };
    }
    return { name: i18n.t('card.txRouterLiFi'), fullAddress: address };
  }

  const contactName = findContactName(address, contacts);
  if (contactName) {
    return {
      name: contactName,
      addressLine: truncateAddress(address),
      fullAddress: address,
    };
  }

  return {
    name: i18n.t('card.txExternalWalletLabel'),
    addressLine: truncateAddress(address),
    fullAddress: address,
  };
}

export function getTxTypeLabel(tx: WalletTx): string {
  switch (tx.activityKind) {
    case 'buy':
      return i18n.t('card.txBuy', {
        symbol: (tx.swapToSymbol ?? tx.tokenSymbol).toUpperCase(),
      });
    case 'sell':
      return i18n.t('card.txSell', {
        symbol: (tx.swapFromSymbol ?? tx.tokenSymbol).toUpperCase(),
      });
    case 'swap':
      return i18n.t('card.txIntentConverted');
    case 'send':
      return i18n.t('card.txIntentSent');
    case 'receive':
      return i18n.t('card.txIntentReceived');
    case 'bridge_out':
      return i18n.t('card.txIntentNetworkTransfer');
    case 'borrow':
      return i18n.t('card.txIntentBorrow');
    case 'repay':
      return i18n.t('card.txIntentRepay');
    case 'deposit':
      return i18n.t('card.txIntentDeposit');
    case 'withdraw':
      return i18n.t('card.txIntentWithdraw');
    default:
      break;
  }

  if (tx.source === 'fiat_deposit') {
    return i18n.t('card.txBridgeFiat');
  }
  if (tx.source === 'fiat_withdraw') {
    return i18n.t('card.txBridgeFiatWithdraw');
  }
  if (tx.source === 'crypto_deposit') {
    return i18n.t('card.txBridgeCrypto');
  }
  if (tx.direction === 'self') return i18n.t('card.txIntentConverted');
  if (tx.direction === 'in') return i18n.t('card.txIntentReceived');
  return i18n.t('card.txIntentSent');
}

function formatSwapPairSubtitle(tx: WalletTx): string | null {
  if (!tx.swapFromSymbol || !tx.swapToSymbol) return null;
  return i18n.t('card.txSwapPairSubtitle', {
    from: getTokenIntentName(tx.swapFromSymbol),
    to: getTokenIntentName(tx.swapToSymbol),
  });
}

export function getTxSubtitleLines(
  tx: WalletTx,
  contacts: TxContactLookup[] = [],
  smartAddress?: string,
): TxSubtitleLines {
  if (tx.statusLabelKey) {
    if (tx.source === 'fiat_deposit') {
      const railLabel = formatDepositPaymentRail(tx.paymentRail);
      const statusText = i18n.t(tx.statusLabelKey);
      const payerLine = formatDepositPayerFromTx(tx);
      return {
        primary: railLabel ?? i18n.t('card.txBridgeFiatSub'),
        secondary: [payerLine, statusText].filter(Boolean).join(' · ') || undefined,
      };
    }
    if (tx.source === 'fiat_withdraw') {
      const recipientLine = formatFiatWithdrawRecipientLine(tx);
      const statusText = i18n.t(tx.statusLabelKey);
      return {
        primary: formatFiatWithdrawRecipientName(tx),
        secondary: [recipientLine, statusText].filter(Boolean).join(' · ') || undefined,
      };
    }
    if (tx.source === 'crypto_deposit') {
      return {
        primary: i18n.t('card.txBridgeCryptoSub'),
        secondary: i18n.t(tx.statusLabelKey),
      };
    }
    return { primary: i18n.t(tx.statusLabelKey) };
  }

  if (tx.activityDetailKey && (
    tx.activityKind === 'borrow'
    || tx.activityKind === 'repay'
    || tx.activityKind === 'deposit'
    || tx.activityKind === 'withdraw'
  )) {
    return { primary: i18n.t(tx.activityDetailKey, tx.activityDetailParams) };
  }

  if (tx.activitySubkind === 'earn') {
    return { primary: i18n.t('card.txSubEarn') };
  }

  if (tx.activitySubkind === 'borrow_collateral') {
    return { primary: i18n.t('card.txSubBorrowCollateral') };
  }

  const swapPair = formatSwapPairSubtitle(tx);
  if (swapPair) return { primary: swapPair };

  if (tx.source === 'fiat_deposit') {
    const railLabel = formatDepositPaymentRail(tx.paymentRail);
    const payerLine = formatDepositPayerFromTx(tx);
    return {
      primary: railLabel ?? i18n.t('card.txBridgeFiatSub'),
      secondary: payerLine ?? undefined,
    };
  }
  if (tx.source === 'fiat_withdraw') {
    const recipientLine = formatFiatWithdrawRecipientLine(tx);
    return {
      primary: formatFiatWithdrawRecipientName(tx),
      secondary: recipientLine,
    };
  }
  if (tx.source === 'crypto_deposit') {
    return { primary: i18n.t('card.txBridgeCryptoSub') };
  }

  if (tx.counterpartyName && tx.direction === 'self') {
    return { primary: tx.counterpartyName };
  }

  const peer = resolvePeerAddress(tx);
  if (peer && isKnownRouterAddress(peer)) {
    if (tx.activityKind === 'receive' || tx.activityKind === 'send') {
      return { primary: getTokenIntentName(tx.tokenSymbol) };
    }
    if (
      tx.activityKind === 'borrow'
      || tx.activityKind === 'repay'
      || tx.activityKind === 'deposit'
      || tx.activityKind === 'withdraw'
    ) {
      const display = resolveAddressDisplay(peer, contacts, smartAddress);
      if (display) return { primary: display.name };
    }
  }

  if (peer) {
    const display = resolveAddressDisplay(peer, contacts, smartAddress);
    if (display) {
      const showAddressLine =
        display.addressLine
        && display.name === i18n.t('card.txExternalWalletLabel');
      return {
        primary: display.name,
        secondary: showAddressLine ? display.addressLine : undefined,
      };
    }
  }

  if (tx.activityKind === 'swap' || tx.direction === 'self') {
    return { primary: i18n.t('card.txOnChain') };
  }

  return { primary: truncateAddress(tx.counterparty) };
}

export function getTxAmountPrefix(tx: WalletTx): string {
  if (tx.activityKind === 'buy' || tx.activityKind === 'sell') {
    return tx.direction === 'in' ? '+' : '−';
  }
  if (tx.activityKind === 'receive' || tx.activityKind === 'borrow' || tx.activityKind === 'withdraw') {
    return '+';
  }
  if (
    tx.activityKind === 'send'
    || tx.activityKind === 'bridge_out'
    || tx.activityKind === 'repay'
    || tx.activityKind === 'deposit'
  ) {
    return '−';
  }
  if (tx.activityKind === 'swap') return '+';
  if (tx.direction === 'self') return '';
  if (tx.direction === 'in') return '+';
  return '−';
}

export type WalletTxIconKind = 'buy' | 'sell' | 'deposit' | 'borrow';

export function getTxIconKind(tx: WalletTx): WalletTxIconKind | null {
  switch (tx.activityKind) {
    case 'buy':
      return 'buy';
    case 'sell':
      return 'sell';
    case 'borrow':
      return 'borrow';
    case 'deposit':
      return 'deposit';
    default:
      break;
  }
  if (tx.source === 'fiat_deposit' || tx.source === 'crypto_deposit') {
    return 'deposit';
  }
  if (tx.source === 'fiat_withdraw') {
    return null;
  }
  return null;
}

export function getTxIconName(tx: WalletTx): string {
  if (tx.source === 'fiat_deposit' || tx.source === 'crypto_deposit') {
    return 'arrow-down-outline';
  }
  if (tx.source === 'fiat_withdraw') {
    return 'arrow-up-outline';
  }
  switch (tx.activityKind) {
    case 'buy':
    case 'sell':
      return tx.direction === 'in' ? 'arrow-down-outline' : 'arrow-up-outline';
    case 'swap':
      return 'swap-horizontal-outline';
    case 'send':
    case 'bridge_out':
      return 'arrow-up-outline';
    case 'receive':
      return 'arrow-down-outline';
    case 'borrow':
    case 'withdraw':
      return 'arrow-down-outline';
    case 'repay':
    case 'deposit':
      return 'arrow-up-outline';
    default:
      if (tx.direction === 'self') return 'swap-horizontal-outline';
      if (tx.direction === 'in') return 'arrow-down-outline';
      return 'arrow-up-outline';
  }
}

export function getTxAccentColor(
  tx: WalletTx,
  colors: { textMuted: string },
): string {
  const isBridge =
    tx.source === 'fiat_deposit'
    || tx.source === 'crypto_deposit'
    || tx.source === 'fiat_withdraw';
  if (isBridge) return tx.statusColor ?? '#10B981';
  if (tx.activityKind === 'buy' || tx.activityKind === 'sell') {
    return tx.direction === 'in' ? '#10B981' : '#F59E0B';
  }
  if (tx.activityKind === 'receive' || tx.activityKind === 'borrow' || tx.activityKind === 'withdraw') {
    return '#10B981';
  }
  if (
    tx.activityKind === 'send'
    || tx.activityKind === 'bridge_out'
    || tx.activityKind === 'repay'
    || tx.activityKind === 'deposit'
  ) {
    return '#F59E0B';
  }
  if (tx.activityKind === 'swap') return colors.textMuted;
  if (tx.direction === 'self') return colors.textMuted;
  if (tx.direction === 'in') return '#10B981';
  return '#F59E0B';
}

export function getTxStatusDisplay(tx: WalletTx): TxStatusDisplay {
  if (tx.statusLabelKey) {
    const pending = tx.statusPending ?? false;
    const failedKeys = new Set([
      'card.statusRefunded',
      'card.cryptoStatusReturned',
      'card.cryptoStatusFailed',
      'card.payoutStatusUndeliverable',
    ]);
    if (failedKeys.has(tx.statusLabelKey)) {
      return {
        labelKey: 'card.txStatusFailed',
        color: tx.statusColor ?? '#EF4444',
        pending: false,
      };
    }
    if (pending) {
      return {
        labelKey: tx.statusLabelKey,
        color: tx.statusColor ?? '#60A5FA',
        pending: true,
      };
    }
    return {
      labelKey: 'card.txStatusCompleted',
      color: tx.statusColor ?? '#10B981',
      pending: false,
    };
  }
  return {
    labelKey: 'card.txStatusCompleted',
    color: '#10B981',
    pending: false,
  };
}

export function getTxFromToDisplays(
  tx: WalletTx,
  contacts: TxContactLookup[],
  smartAddress: string,
): { from: AddressDisplay | null; to: AddressDisplay | null } {
  const fromAddr = tx.fromAddress ?? (tx.direction === 'in' ? tx.counterparty : smartAddress);
  const toAddr = tx.toAddress ?? (tx.direction === 'out' ? tx.counterparty : smartAddress);

  if (tx.source !== 'chain') {
    if (tx.source === 'fiat_withdraw') {
      const recipientLine = formatFiatWithdrawRecipientLine(tx);
      return {
        from: resolveAddressDisplay(smartAddress, contacts, smartAddress),
        to: {
          name: formatFiatWithdrawRecipientName(tx),
          addressLine: recipientLine,
        },
      };
    }
    return {
      from: null,
      to: resolveAddressDisplay(smartAddress, contacts, smartAddress),
    };
  }

  return {
    from: resolveAddressDisplay(fromAddr, contacts, smartAddress),
    to: resolveAddressDisplay(toAddr, contacts, smartAddress),
  };
}

export function getTxRecipientDisplay(
  tx: WalletTx,
  contacts: TxContactLookup[],
  smartAddress: string,
): AddressDisplay | null {
  if (tx.source === 'fiat_deposit') {
    const fiat = getBridgeSourceFiat(tx);
    const payerLine = formatDepositPayerFromTx(tx);
    if (payerLine) {
      const segments = payerLine.split(' · ');
      return {
        name: segments[0],
        addressLine: segments.length > 1
          ? segments.slice(1).join(' · ')
          : formatDepositPaymentRail(tx.paymentRail) ?? fiat?.currency,
      };
    }
    return {
      name: i18n.t('card.txBridgeFiatSub'),
      addressLine: formatDepositPaymentRail(tx.paymentRail) ?? fiat?.currency,
    };
  }
  if (tx.source === 'fiat_withdraw') {
    return {
      name: formatFiatWithdrawRecipientName(tx),
      addressLine: formatFiatWithdrawRecipientLine(tx),
    };
  }
  if (tx.activityKind === 'borrow' || tx.activityKind === 'repay') {
    return { name: i18n.t('card.txRouterMorpho') };
  }
  if (tx.activityKind === 'deposit' && tx.activitySubkind === 'earn') {
    return { name: i18n.t('card.txSubEarn') };
  }
  if (tx.activityKind === 'deposit' && tx.activitySubkind === 'borrow_collateral') {
    return { name: i18n.t('card.txRouterMorpho') };
  }
  if (tx.activityKind === 'withdraw' && tx.activitySubkind === 'earn') {
    return { name: i18n.t('card.txSubEarn') };
  }
  if (tx.activityKind === 'withdraw' && tx.activitySubkind === 'borrow_collateral') {
    return { name: i18n.t('card.txRouterMorpho') };
  }
  if (tx.activityKind === 'send' || tx.direction === 'out') {
    return resolveAddressDisplay(tx.toAddress ?? tx.counterparty, contacts, smartAddress);
  }
  if (tx.activityKind === 'receive' || tx.direction === 'in') {
    return resolveAddressDisplay(tx.fromAddress ?? tx.counterparty, contacts, smartAddress);
  }
  return null;
}

export function usesMonoSubtitle(_tx: WalletTx): boolean {
  return false;
}
