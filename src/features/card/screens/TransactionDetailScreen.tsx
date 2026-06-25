import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { WalletTx } from '../hooks/useWalletHistory';
import {
  formatTxAmount,
  formatTxFullDate,
  getTxAccentColor,
  getTxAmountPrefix,
  getTxTypeLabel,
  truncateAddress,
} from '../utils/walletTxDisplay';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useHideBalance } from '../../../shared/hooks/useHideBalance';
import { HIDDEN_BALANCE_TEXT } from '../../../shared/utils/privacyDisplay';

export type TransactionDetailParams = {
  TransactionDetail: {
    tx: WalletTx;
    smartAddress: string;
  };
};

interface DetailRowProps {
  label: string;
  value: string;
  mono?: boolean;
  copyValue?: string;
  valueColor?: string;
  colors: ThemeColors;
}

function DetailRow({ label, value, mono, copyValue, valueColor, colors }: DetailRowProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const rs = useMemo(() => detailRowStyles(colors), [colors]);

  const handleCopy = useCallback(async () => {
    if (!copyValue) return;
    await Clipboard.setStringAsync(copyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [copyValue]);

  return (
    <View style={rs.row}>
      <Text style={rs.label}>{label}</Text>
      <View style={rs.valueRow}>
        <Text
          style={[
            rs.value,
            mono && rs.mono,
            valueColor ? { color: valueColor } : null,
          ]}
          selectable={!!copyValue}
        >
          {value}
        </Text>
        {copyValue ? (
          <TouchableOpacity onPress={() => void handleCopy()} hitSlop={8} activeOpacity={0.7}>
            <Ionicons
              name={copied ? 'checkmark-circle' : 'copy-outline'}
              size={18}
              color={copied ? colors.success : colors.textFaint}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      {copied ? (
        <Text style={rs.copiedHint}>{t('card.copied')}</Text>
      ) : null}
    </View>
  );
}

function detailRowStyles(c: ThemeColors) {
  return StyleSheet.create({
    row: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      gap: 6,
    },
    label: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    valueRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    value: { color: c.text, fontSize: 14, fontWeight: '500', flex: 1 },
    mono: { fontFamily: 'monospace', fontSize: 13 },
    copiedHint: { color: c.success, fontSize: 11, fontWeight: '600' },
  });
}

export default function TransactionDetailScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<TransactionDetailParams, 'TransactionDetail'>>();
  const hideBalance = useHideBalance();

  const tx = route.params?.tx;
  const smartAddress = route.params?.smartAddress ?? '';

  if (!tx) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.navBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.screenTitle}>{t('card.transactionDetail')}</Text>
          <View style={s.navBtn} />
        </View>
      </View>
    );
  }

  const accent = getTxAccentColor(tx, colors);
  const typeLabel = getTxTypeLabel(tx);
  const amountPrefix = getTxAmountPrefix(tx);
  const isBridge = tx.source === 'fiat_deposit' || tx.source === 'crypto_deposit';

  const iconName = isBridge
    ? 'arrow-down-outline'
    : tx.direction === 'self'
      ? 'swap-horizontal-outline'
      : tx.direction === 'in'
        ? 'arrow-down-outline'
        : 'arrow-up-outline';

  const openExplorer = useCallback(() => {
    if (!tx.hash) return;
    Linking.openURL(`https://base.blockscout.com/tx/${tx.hash}`).catch(() => undefined);
  }, [tx.hash]);

  const feeRows = [
    tx.grossAmountLabel ? { label: t('card.txGrossAmount'), value: tx.grossAmountLabel } : null,
    tx.exchangeFee ? { label: t('card.txExchangeFee'), value: tx.exchangeFee } : null,
    tx.developerFee ? { label: t('card.txDeveloperFee'), value: tx.developerFee } : null,
    tx.gasFee ? { label: t('card.networkFee'), value: tx.gasFee } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const destinationLabel =
    tx.destinationRail && tx.destinationCurrency
      ? `${tx.destinationCurrency.toUpperCase()} · ${tx.destinationRail.toUpperCase()}`
      : tx.destinationCurrency?.toUpperCase() ?? null;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.navBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.screenTitle}>{t('card.transactionDetail')}</Text>
        <View style={s.navBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.hero}>
          <View style={[s.heroIcon, { backgroundColor: `${accent}1A` }]}>
            <Ionicons name={iconName as any} size={28} color={accent} />
          </View>
          <Text style={[s.heroAmount, { color: accent }]}>
            {hideBalance
              ? HIDDEN_BALANCE_TEXT
              : `${amountPrefix}${formatTxAmount(tx.amount, tx.tokenSymbol)}`}
          </Text>
          <Text style={s.heroType}>{typeLabel}</Text>
          {tx.statusLabelKey ? (
            <View style={s.statusRow}>
              {tx.statusPending ? (
                <ActivityIndicator size="small" color={tx.statusColor ?? accent} />
              ) : null}
              <Text style={[s.statusText, { color: tx.statusColor ?? accent }]}>
                {t(tx.statusLabelKey)}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={s.card}>
          <DetailRow
            label={t('card.txType')}
            value={typeLabel}
            colors={colors}
          />
          <DetailRow
            label={t('card.txDate')}
            value={formatTxFullDate(tx.timestamp)}
            colors={colors}
          />
          {tx.updatedAt ? (
            <DetailRow
              label={t('card.txUpdated')}
              value={formatTxFullDate(tx.updatedAt)}
              colors={colors}
            />
          ) : null}
          <DetailRow
            label={t('card.network')}
            value={isBridge ? t('card.txBridgeNetwork') : t('card.txNetworkBase')}
            colors={colors}
          />
          {tx.statusLabelKey ? (
            <DetailRow
              label={t('card.txStatus')}
              value={t(tx.statusLabelKey)}
              valueColor={tx.statusColor}
              colors={colors}
            />
          ) : null}
          {destinationLabel ? (
            <DetailRow label={t('card.txDestination')} value={destinationLabel} colors={colors} />
          ) : null}
          {feeRows.map((row) => (
            <DetailRow key={row.label} label={row.label} value={row.value} colors={colors} />
          ))}
          {tx.fromAddress ? (
            <DetailRow
              label={t('card.txFrom')}
              value={truncateAddress(tx.fromAddress)}
              mono
              copyValue={tx.fromAddress}
              colors={colors}
            />
          ) : null}
          {tx.toAddress ? (
            <DetailRow
              label={t('card.txTo')}
              value={truncateAddress(tx.toAddress)}
              mono
              copyValue={tx.toAddress}
              colors={colors}
            />
          ) : null}
          {!tx.fromAddress && !tx.toAddress && smartAddress ? (
            <DetailRow
              label={t('card.txWallet')}
              value={truncateAddress(smartAddress)}
              mono
              copyValue={smartAddress}
              colors={colors}
            />
          ) : null}
          {tx.tokenContract ? (
            <DetailRow
              label={t('card.txTokenContract')}
              value={truncateAddress(tx.tokenContract)}
              mono
              copyValue={tx.tokenContract}
              colors={colors}
            />
          ) : null}
          {tx.bridgeReferenceId ? (
            <DetailRow
              label={t('card.txReference')}
              value={tx.bridgeReferenceId}
              mono
              copyValue={tx.bridgeReferenceId}
              colors={colors}
            />
          ) : null}
          {tx.hash ? (
            <DetailRow
              label={t('card.txHash')}
              value={truncateAddress(tx.hash)}
              mono
              copyValue={tx.hash}
              colors={colors}
            />
          ) : null}
        </View>

        {tx.hash ? (
          <TouchableOpacity style={s.explorerBtn} onPress={openExplorer} activeOpacity={0.85}>
            <Ionicons name="open-outline" size={18} color={colors.primary} />
            <Text style={s.explorerText}>{t('card.viewOnBlockscout')}</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    navBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    screenTitle: { color: c.text, fontSize: 17, fontWeight: '700' },
    content: { paddingHorizontal: 16, paddingTop: 8, gap: 16 },
    hero: { alignItems: 'center', paddingVertical: 24, gap: 8 },
    heroIcon: {
      width: 64,
      height: 64,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    heroAmount: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
    heroType: { color: c.textMuted, fontSize: 15, fontWeight: '600' },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    statusText: { fontSize: 14, fontWeight: '600' },
    card: {
      backgroundColor: c.surface,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: c.border,
    },
    explorerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    explorerText: { color: c.primary, fontSize: 15, fontWeight: '700' },
  });
}
