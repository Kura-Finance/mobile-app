import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Clipboard, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import QuickAction, { quickActionsRow } from '../QuickAction';
import WalletBalanceRow from '../WalletBalanceRow';
import WalletHistorySection from './WalletHistorySection';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';

interface WalletDashboardProps {
  usdcBalance: number;
  wethBalance: number;
  truncatedAddress: string;
  smartAddress: string;
  onRefresh: () => void;
  onTopUp: () => void;
  onSend: () => void;
  onReceive: () => void;
  onSwap: () => void;
}

export default function WalletDashboard({
  usdcBalance,
  wethBalance,
  truncatedAddress,
  smartAddress,
  onRefresh,
  onTopUp,
  onSend,
  onReceive,
  onSwap,
}: WalletDashboardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const usdFormatted = usdcBalance.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <>
      {/* Balance header */}
      <View style={s.balanceHeader}>
        <View style={s.balanceLabelRow}>
          <Text style={s.balanceLabel}>{t('card.cardWalletBalance')}</Text>
          <TouchableOpacity onPress={onRefresh} style={s.refreshIconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="refresh-outline" size={15} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        <Text style={s.balanceValue}>${usdFormatted}</Text>
        <TouchableOpacity onPress={() => Clipboard.setString(smartAddress)} style={s.addressRow}>
          <View style={s.scBadge}>
            <Ionicons name="cube-outline" size={11} color={colors.primary} />
            <Text style={s.scBadgeText}>{t('card.smartContract')}</Text>
          </View>
          <Text style={s.addressText}>{truncatedAddress}</Text>
          <Ionicons name="copy-outline" size={13} color={colors.textMuted} />
        </TouchableOpacity>
        <Text style={s.balanceSub}>{t('card.baseNetworkUsdc')}</Text>
      </View>

      {/* Quick Actions */}
      <View style={quickActionsRow}>
        <QuickAction icon="add-circle-outline"      label={t('card.topUp')}   onPress={onTopUp}   color="#8B5CF6" />
        <QuickAction icon="arrow-up-outline"        label={t('card.send')}    onPress={onSend}    color="#3B82F6" />
        <QuickAction icon="arrow-down-outline"      label={t('card.receive')} onPress={onReceive} color="#10B981" />
        <QuickAction icon="swap-horizontal-outline" label={t('card.swap')}    onPress={onSwap}    color="#F59E0B" />
      </View>

      {/* Assets */}
      <Text style={s.sectionTitle}>{t('card.assets')}</Text>
      <View style={s.tokenList}>
        <WalletBalanceRow
          icon="logo-usd"
          symbol="USDC"
          name={t('card.usdCoinBase')}
          balance={usdcBalance.toFixed(2)}
          usdValue={`$${usdFormatted}`}
          color="#2775CA"
        />
        <WalletBalanceRow
          icon="layers-outline"
          symbol="WETH"
          name={t('card.wrappedEtherBase')}
          balance={wethBalance.toFixed(6)}
          usdValue="—"
          color="#627EEA"
        />
      </View>

      {/* Wallet info */}
      <Text style={s.sectionTitle}>{t('card.walletInfo')}</Text>
      <View style={s.infoCard}>
        {[
          { label: t('card.standard'), value: 'ERC-4337', highlight: false },
          { label: t('card.network'), value: 'Base Mainnet', highlight: false },
          { label: t('card.gas'), value: t('card.sponsored'), highlight: true },
          { label: t('card.custody'), value: t('card.nonCustodial'), highlight: false },
        ].map(({ label, value, highlight }) => (
          <View key={label} style={s.infoRow}>
            <Text style={s.infoLabel}>{label}</Text>
            <Text style={[s.infoValue, highlight && { color: '#10B981' }]}>{value}</Text>
          </View>
        ))}
      </View>

      {/* History */}
      <WalletHistorySection smartAddress={smartAddress} sectionTitleStyle={s.sectionTitle} />
    </>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    balanceHeader: { alignItems: 'center', paddingVertical: 28, marginBottom: 8 },
    balanceLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    balanceLabel: { color: c.textMuted, fontSize: 13 },
    refreshIconBtn: {
      width: 26, height: 26, borderRadius: 13,
      backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center',
    },
    balanceValue: { color: c.text, fontSize: 36, fontWeight: '700', letterSpacing: -1 },
    balanceSub: { color: c.textFaint, fontSize: 12, marginTop: 4 },
    addressRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
      backgroundColor: c.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    },
    scBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: 'rgba(139,92,246,0.15)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
    },
    scBadgeText: { color: c.primary, fontSize: 10, fontWeight: '600' },
    addressText: { color: c.textMuted, fontSize: 12, fontFamily: 'monospace', flex: 1 },
    sectionTitle: {
      color: c.textMuted, fontSize: 12, fontWeight: '700',
      textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14,
    },
    tokenList: {
      backgroundColor: c.surface, borderRadius: 16, overflow: 'hidden',
      marginBottom: 20, borderWidth: 1, borderColor: c.primarySoft,
    },
    infoCard: {
      backgroundColor: c.surface, borderRadius: 16, overflow: 'hidden',
      marginBottom: 20, borderWidth: 1, borderColor: c.primarySoft,
    },
    infoRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: 14, borderBottomWidth: 1, borderBottomColor: c.border,
    },
    infoLabel: { color: c.textMuted, fontSize: 13 },
    infoValue: { color: c.text, fontSize: 13, fontWeight: '600' },
  });
}
