import i18n from '../../../shared/locales/i18n';
import type { WalletTx } from '../hooks/useWalletHistory';

export function formatTxAmount(amount: number, symbol: string): string {
  const abs = Math.abs(amount);
  let str: string;
  if (abs === 0) str = '0';
  else if (abs < 0.000001) str = abs.toExponential(2);
  else if (abs < 0.01) str = abs.toFixed(6);
  else if (abs < 1000) str = abs.toFixed(abs < 1 ? 4 : 2);
  else str = abs.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return `${str} ${symbol}`;
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

export function getTxTypeLabel(tx: WalletTx): string {
  if (tx.source === 'fiat_deposit') return i18n.t('card.txBridgeFiat');
  if (tx.source === 'crypto_deposit') return i18n.t('card.txBridgeCrypto');
  if (tx.direction === 'self') return i18n.t('card.self');
  if (tx.direction === 'in') return i18n.t('card.received');
  return i18n.t('card.sent');
}

export function getTxAmountPrefix(tx: WalletTx): string {
  if (tx.direction === 'self') return '';
  if (tx.direction === 'in') return '+';
  return '−';
}

export function getTxAccentColor(
  tx: WalletTx,
  colors: { textMuted: string },
): string {
  const isBridge = tx.source === 'fiat_deposit' || tx.source === 'crypto_deposit';
  if (isBridge) return tx.statusColor ?? '#10B981';
  if (tx.direction === 'self') return colors.textMuted;
  if (tx.direction === 'in') return '#10B981';
  return '#F59E0B';
}
