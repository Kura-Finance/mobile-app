import React, { useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { WalletTx } from '../../hooks/useWalletHistory';
import {
  formatTxAmount,
  formatTxRelativeTime,
  getTxAccentColor,
  getTxAmountPrefix,
  getTxTypeLabel,
  truncateAddress,
} from '../../utils/walletTxDisplay';
import { useHideBalance } from '../../../../shared/hooks/useHideBalance';
import { HIDDEN_BALANCE_TEXT } from '../../../../shared/utils/privacyDisplay';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';

interface Props {
  tx: WalletTx;
  onPress?: (tx: WalletTx) => void;
}

export default function WalletTxRow({ tx, onPress }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const hideBalance = useHideBalance();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const isBridge = tx.source === 'fiat_deposit' || tx.source === 'crypto_deposit';

  const accent = getTxAccentColor(tx, colors);
  const typeLabel = getTxTypeLabel(tx);
  const amountPrefix = getTxAmountPrefix(tx);
  const subtitle = tx.statusLabelKey
    ? t(tx.statusLabelKey)
    : (tx.counterpartyName ?? truncateAddress(tx.counterparty));
  const subtitleColor = tx.statusLabelKey ? (tx.statusColor ?? colors.textMuted) : colors.textMuted;

  const directionIcon: string = isBridge
    ? 'arrow-down-outline'
    : tx.direction === 'self'
      ? 'swap-horizontal-outline'
      : tx.direction === 'in'
        ? 'arrow-down-outline'
        : 'arrow-up-outline';

  const handlePress = useCallback(() => {
    onPress?.(tx);
  }, [onPress, tx]);

  return (
    <TouchableOpacity
      style={s.row}
      onPress={onPress ? handlePress : undefined}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={[s.iconWrap, { backgroundColor: `${accent}1A` }]}>
        <Ionicons name={directionIcon as any} size={18} color={accent} />
      </View>
      <View style={s.info}>
        <Text style={s.label}>{typeLabel}</Text>
        <View style={s.subtitleRow}>
          {tx.statusPending ? (
            <ActivityIndicator size="small" color={subtitleColor} style={s.subtitleSpinner} />
          ) : null}
          <Text
            style={[
              s.counterparty,
              tx.statusLabelKey ? { color: subtitleColor } : s.counterpartyMono,
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </View>
      </View>
      <View style={s.right}>
        <Text style={[s.amount, { color: accent }]}>
          {hideBalance
            ? HIDDEN_BALANCE_TEXT
            : `${amountPrefix}${formatTxAmount(tx.amount, tx.tokenSymbol)}`}
        </Text>
        <Text style={s.time}>{formatTxRelativeTime(tx.timestamp)}</Text>
      </View>
      {onPress ? (
        <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
      ) : null}
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
    subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    subtitleSpinner: { transform: [{ scale: 0.75 }] },
    counterparty: { color: c.textMuted, fontSize: 11, flexShrink: 1 },
    counterpartyMono: { fontFamily: 'monospace' },
    right: { alignItems: 'flex-end' },
    amount: { fontSize: 13, fontWeight: '700', marginBottom: 3 },
    time: { color: c.textFaint, fontSize: 11 },
  });
}
