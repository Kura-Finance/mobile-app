import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import { useMoneyFormat } from '../../../../shared/hooks/useMoneyFormat';
import { useHideBalance } from '../../../../shared/hooks/useHideBalance';
import { HIDDEN_BALANCE_TEXT } from '../../../../shared/utils/privacyDisplay';
import type { DefiToken } from '../../hooks/useDefiPortfolio';

const PREVIEW = 4;

interface Props {
  tokens: DefiToken[];
  onViewAll: () => void;
}

function chainLabel(chain: string, t: ReturnType<typeof useTranslation>['t']): string {
  return t(`trackfi.defiPortfolio.chains.${chain}`, { defaultValue: chain.toUpperCase() });
}

function TokenRow({ token }: { token: DefiToken }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const money = useMoneyFormat();
  const hideBalance = useHideBalance();
  const st = useMemo(() => makeRowStyles(colors), [colors]);

  return (
    <View style={st.row}>
      <View style={st.left}>
        {token.logoUrl ? (
          <Image source={{ uri: token.logoUrl }} style={st.logo} />
        ) : (
          <View style={[st.logo, st.logoFallback]}>
            <Text style={st.logoText}>{token.symbol.slice(0, 2)}</Text>
          </View>
        )}
        <View style={st.meta}>
          <View style={st.symbolRow}>
            <Text style={st.symbol}>{token.symbol}</Text>
            <View style={st.chainTag}>
              <Text style={st.chainText}>{chainLabel(token.chain, t)}</Text>
            </View>
          </View>
          <Text style={st.name} numberOfLines={1}>{token.name}</Text>
        </View>
      </View>
      <View style={st.midCol}>
        <Text style={st.balance}>
          {token.amount < 0.001
            ? token.amount.toExponential(2)
            : token.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
        </Text>
        <Text style={st.balanceUsd}>
          {hideBalance ? HIDDEN_BALANCE_TEXT : money.compact(token.usdValue)}
        </Text>
      </View>
      <View style={st.valueCol}>
        <Text style={st.value}>
          {hideBalance ? HIDDEN_BALANCE_TEXT : money.compact(token.usdValue)}
        </Text>
      </View>
      <Text style={st.change}>—</Text>
    </View>
  );
}

export default function DefiTokensSection({ tokens, onViewAll }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const preview = tokens.slice(0, PREVIEW);
  const isEmpty = tokens.length === 0;

  return (
    <View style={st.wrap}>
      <View style={st.header}>
        <Text style={st.title}>
          {t('trackfi.defi.tokensTitle', { count: tokens.length })}
        </Text>
        {!isEmpty && tokens.length > PREVIEW ? (
          <TouchableOpacity onPress={onViewAll} activeOpacity={0.7} style={st.viewAll}>
            <Text style={st.viewAllText}>{t('trackfi.defi.viewAll')}</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={st.card}>
        {!isEmpty ? (
          <View style={st.tableHead}>
            <Text style={[st.colHead, st.colBalance]}>{t('trackfi.defi.colBalance')}</Text>
            <Text style={[st.colHead, st.colValue]}>{t('trackfi.defi.colValue')}</Text>
            <Text style={[st.colHead, st.col24h]}>{t('trackfi.defi.col24h')}</Text>
          </View>
        ) : null}
        {isEmpty ? (
          <Text style={st.emptyText}>{t('trackfi.defi.noTokens')}</Text>
        ) : (
          preview.map((token) => (
            <TokenRow key={`${token.chain}-${token.id}`} token={token} />
          ))
        )}
      </View>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    wrap: { marginBottom: 16 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    title: {
      color: c.text,
      fontSize: 18,
      fontWeight: '700',
    },
    viewAll: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    viewAllText: {
      color: c.primary,
      fontSize: 13,
      fontWeight: '600',
    },
    card: {
      backgroundColor: c.surfaceAlt,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingBottom: 4,
    },
    tableHead: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 6,
      gap: 8,
    },
    colHead: {
      color: c.textFaint,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    colBalance: { width: 80, textAlign: 'right' },
    colValue: { width: 72, textAlign: 'right' },
    col24h: { width: 36, textAlign: 'right' },
    emptyText: {
      color: c.textMuted,
      fontSize: 13,
      textAlign: 'center',
      paddingVertical: 20,
      paddingHorizontal: 14,
    },
  });
}

function makeRowStyles(c: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 8,
    },
    left: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minWidth: 0,
      paddingRight: 8,
    },
    logo: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    logoFallback: {
      backgroundColor: c.surfaceInput,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoText: {
      color: c.textMuted,
      fontSize: 10,
      fontWeight: '700',
    },
    meta: { flex: 1, minWidth: 0 },
    symbolRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    symbol: {
      color: c.text,
      fontSize: 14,
      fontWeight: '700',
    },
    chainTag: {
      backgroundColor: c.surfaceInput,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    chainText: {
      color: c.textFaint,
      fontSize: 9,
      fontWeight: '700',
    },
    name: {
      color: c.textMuted,
      fontSize: 11,
      marginTop: 2,
    },
    midCol: {
      width: 80,
      alignItems: 'flex-end',
    },
    balance: {
      color: c.text,
      fontSize: 12,
      fontWeight: '600',
    },
    balanceUsd: {
      color: c.textFaint,
      fontSize: 10,
    },
    valueCol: {
      width: 72,
      alignItems: 'flex-end',
    },
    value: {
      color: c.text,
      fontSize: 13,
      fontWeight: '700',
    },
    change: {
      color: c.textFaint,
      fontSize: 10,
      fontWeight: '500',
      width: 36,
      textAlign: 'right',
    },
  });
}
