import React, { useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import i18n from '../../../../shared/locales/i18n';
import { useHideBalance } from '../../../../shared/hooks/useHideBalance';
import { HIDDEN_BALANCE_TEXT } from '../../../../shared/utils/privacyDisplay';
import type { WalletTx } from '../../hooks/useWalletHistory';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';

function formatAmount(amount: number, symbol: string): string {
  const abs = Math.abs(amount);
  let str: string;
  if (abs === 0) str = '0';
  else if (abs < 0.000001) str = abs.toExponential(2);
  else if (abs < 0.01) str = abs.toFixed(6);
  else if (abs < 1000) str = abs.toFixed(abs < 1 ? 4 : 2);
  else str = abs.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return `${str} ${symbol}`;
}

function formatTime(isoTimestamp: string): string {
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

function truncateAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

interface Props {
  tx: WalletTx;
}

export default function WalletTxRow({ tx }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const hideBalance = useHideBalance();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const isIn = tx.direction === 'in';
  const isSelf = tx.direction === 'self';

  const directionColor = isSelf ? colors.textMuted : isIn ? '#10B981' : '#F59E0B';
  const directionIcon: string = isSelf
    ? 'swap-horizontal-outline'
    : isIn
      ? 'arrow-down-outline'
      : 'arrow-up-outline';
  const directionLabel = isSelf ? t('card.self') : isIn ? t('card.received') : t('card.sent');
  const amountPrefix = isSelf ? '' : isIn ? '+' : '−';

  const openExplorer = useCallback(() => {
    Linking.openURL(`https://base.blockscout.com/tx/${tx.hash}`).catch(() => undefined);
  }, [tx.hash]);

  const copyHash = useCallback(() => {
    Clipboard.setStringAsync(tx.hash).catch(() => undefined);
  }, [tx.hash]);

  return (
    <TouchableOpacity style={s.row} onPress={openExplorer} onLongPress={copyHash} activeOpacity={0.7}>
      <View style={[s.iconWrap, { backgroundColor: `${directionColor}1A` }]}>
        <Ionicons name={directionIcon as any} size={18} color={directionColor} />
      </View>
      <View style={s.info}>
        <Text style={s.label}>{directionLabel}</Text>
        <Text style={s.counterparty} numberOfLines={1}>
          {tx.counterpartyName ?? truncateAddr(tx.counterparty)}
        </Text>
      </View>
      <View style={s.right}>
        <Text style={[s.amount, { color: directionColor }]}>
          {hideBalance
            ? HIDDEN_BALANCE_TEXT
            : `${amountPrefix}${formatAmount(tx.amount, tx.tokenSymbol)}`}
        </Text>
        <Text style={s.time}>{formatTime(tx.timestamp)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      gap: 12,
    },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: { flex: 1 },
    label: { color: c.text, fontSize: 13, fontWeight: '600', marginBottom: 3 },
    counterparty: { color: c.textMuted, fontSize: 11, fontFamily: 'monospace' },
    right: { alignItems: 'flex-end' },
    amount: { fontSize: 13, fontWeight: '700', marginBottom: 3 },
    time: { color: c.textFaint, fontSize: 11 },
  });
}
