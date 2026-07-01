import React, { memo, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import LoadingDots from '../../../../shared/components/LoadingDots';
import { Ionicons } from '@expo/vector-icons';
import type { WalletTx } from '../../hooks/useWalletHistory';
import type { CryptoContact } from '../../hooks/useCryptoContacts';
import {
  formatTxRelativeTime,
  formatTxListAmount,
  getTxAccentColor,
  getTxSubtitleLines,
  getTxTypeLabel,
} from '../../utils/walletTxDisplay';
import WalletTxIcon from './WalletTxIcon';
import { useHideBalance } from '../../../../shared/hooks/useHideBalance';
import { useMoneyFormat } from '../../../../shared/hooks/useMoneyFormat';
import { HIDDEN_BALANCE_TEXT } from '../../../../shared/utils/privacyDisplay';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';

interface Props {
  tx: WalletTx;
  contacts?: CryptoContact[];
  onPress?: (tx: WalletTx) => void;
}

function WalletTxRow({ tx, contacts = [], onPress }: Props) {
  const { colors } = useTheme();
  const hideBalance = useHideBalance();
  const money = useMoneyFormat();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const accent = getTxAccentColor(tx, colors);
  const typeLabel = getTxTypeLabel(tx);
  const subtitleLines = getTxSubtitleLines(tx, contacts);
  const subtitleColor = tx.statusLabelKey ? (tx.statusColor ?? colors.textMuted) : colors.textMuted;

  const displayAmount = hideBalance
    ? HIDDEN_BALANCE_TEXT
    : formatTxListAmount(tx, money.value);

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
        <WalletTxIcon tx={tx} size={18} color={accent} />
      </View>
      <View style={s.info}>
        <Text style={s.label}>{typeLabel}</Text>
        <View style={s.subtitleRow}>
          {tx.statusPending ? (
            <LoadingDots compact color={subtitleColor} size={6}   style={s.subtitleSpinner}  />
          ) : null}
          <View style={s.subtitleCol}>
            <Text
              style={[
                s.counterparty,
                tx.statusLabelKey ? { color: subtitleColor } : null,
              ]}
              numberOfLines={1}
            >
              {subtitleLines.primary}
            </Text>
            {subtitleLines.secondary ? (
              <Text style={s.counterpartySub} numberOfLines={1}>
                {subtitleLines.secondary}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
      <View style={s.right}>
        <Text style={[s.amount, { color: accent }]}>{displayAmount}</Text>
        <Text style={s.time}>{formatTxRelativeTime(tx.timestamp)}</Text>
      </View>
      {onPress ? (
        <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
      ) : null}
    </TouchableOpacity>
  );
}

function areWalletTxRowPropsEqual(prev: Props, next: Props): boolean {
  if (prev.onPress !== next.onPress || prev.contacts !== next.contacts) return false;
  return (
    prev.tx.id === next.tx.id
    && prev.tx.statusPending === next.tx.statusPending
    && prev.tx.amount === next.tx.amount
    && prev.tx.tokenSymbol === next.tx.tokenSymbol
    && prev.tx.activityKind === next.tx.activityKind
  );
}

export default memo(WalletTxRow, areWalletTxRowPropsEqual);

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
    subtitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
    subtitleCol: { flex: 1, gap: 2 },
    subtitleSpinner: { transform: [{ scale: 0.75 }], marginTop: 2 },
    counterparty: { color: c.textMuted, fontSize: 11, flexShrink: 1 },
    counterpartySub: { color: c.textFaint, fontSize: 10, fontFamily: 'monospace' },
    right: { alignItems: 'flex-end' },
    amount: { fontSize: 13, fontWeight: '700', marginBottom: 3 },
    time: { color: c.textFaint, fontSize: 11 },
  });
}
