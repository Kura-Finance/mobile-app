import LoadingDots from '../../../shared/components/LoadingDots';
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { WalletTx } from '../hooks/useWalletHistory';
import {
  formatDepositPaymentRail,
  formatDepositPayerAccountLine,
  formatTxDetailAmount,
  formatTxFullDate,
  formatTxListAmount,
  formatTxProcessedWith,
  getTxAccentColor,
  getTxFromToDisplays,
  getTxRecipientDisplay,
  getTxStatusDisplay,
  getTxTypeLabel,
  isExternalAddressDisplay,
  truncateAddress,
} from '../utils/walletTxDisplay';
import WalletTxIcon from '../components/wallet/WalletTxIcon';
import { BASE_CHAIN , useCryptoContacts } from '../hooks/useCryptoContacts';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useHideBalance } from '../../../shared/hooks/useHideBalance';
import { useMoneyFormat } from '../../../shared/hooks/useMoneyFormat';
import { HIDDEN_BALANCE_TEXT } from '../../../shared/utils/privacyDisplay';
import type { AddressDisplay } from '../utils/walletTxDisplay';

export type TransactionDetailParams = {
  TransactionDetail: {
    tx: WalletTx;
    smartAddress: string;
  };
};

function CopyButton({
  value,
  colors,
}: {
  value: string;
  colors: ThemeColors;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value]);

  return (
    <TouchableOpacity onPress={() => void handleCopy()} hitSlop={8} activeOpacity={0.7}>
      <Ionicons
        name={copied ? 'checkmark-circle' : 'copy-outline'}
        size={18}
        color={copied ? colors.success : colors.textFaint}
      />
    </TouchableOpacity>
  );
}

function DetailNavRow({
  icon,
  iconColor,
  iconBg,
  label,
  value,
  subValue,
  badge,
  copyValue,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
  subValue?: string;
  badge?: string;
  copyValue?: string;
  colors: ThemeColors;
}) {
  const rs = useMemo(() => navRowStyles(colors), [colors]);

  return (
    <View style={rs.row}>
      <View style={[rs.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={rs.body}>
        <Text style={rs.label}>{label}</Text>
        <View style={rs.valueRow}>
          <Text style={rs.valueText} numberOfLines={2}>{value}</Text>
          {badge ? (
            <View style={rs.badge}>
              <View style={rs.badgeDot} />
              <Text style={rs.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        {subValue ? <Text style={rs.subValue}>{subValue}</Text> : null}
      </View>
      {copyValue ? <CopyButton value={copyValue} colors={colors} /> : null}
    </View>
  );
}

function PartyCard({
  title,
  party,
  colors,
  canSaveRecipient,
  onSaveRecipient,
  savingRecipient,
  saveError,
}: {
  title: string;
  party: AddressDisplay;
  colors: ThemeColors;
  canSaveRecipient?: boolean;
  onSaveRecipient?: (name: string) => void;
  savingRecipient?: boolean;
  saveError?: string | null;
}) {
  const { t } = useTranslation();
  const s = useMemo(() => partyCardStyles(colors), [colors]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  const handleSave = useCallback(() => {
    if (!onSaveRecipient) return;
    onSaveRecipient(name.trim());
  }, [name, onSaveRecipient]);

  return (
    <View style={s.card}>
      <View style={s.copy}>
        <Text style={s.title}>{title}</Text>
        <Text style={s.name}>{party.name}</Text>
        {party.addressLine ? (
          <Text style={s.address}>{party.addressLine}</Text>
        ) : null}
        {canSaveRecipient && !editing ? (
          <TouchableOpacity
            onPress={() => setEditing(true)}
            style={s.saveBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="person-add-outline" size={16} color={colors.primary} />
            <Text style={s.saveBtnText}>{t('card.saveRecipient')}</Text>
          </TouchableOpacity>
        ) : null}
        {canSaveRecipient && editing ? (
          <View style={s.saveForm}>
            <TextInput
              style={s.nameInput}
              placeholder={t('card.namePlaceholder')}
              placeholderTextColor={colors.textFaint}
              value={name}
              onChangeText={setName}
              autoFocus
            />
            <View style={s.saveActions}>
              <TouchableOpacity
                onPress={() => { setEditing(false); setName(''); }}
                style={s.cancelBtn}
                activeOpacity={0.7}
              >
                <Text style={s.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                style={[s.confirmBtn, savingRecipient && s.confirmBtnDisabled]}
                activeOpacity={0.85}
                disabled={savingRecipient}
              >
                {savingRecipient ? (
                  <LoadingDots compact color="#FFF" size={6}    />
                ) : (
                  <Text style={s.confirmBtnText}>{t('card.saveRecipient')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
        {saveError ? (
          <Text style={s.saveError}>{saveError}</Text>
        ) : null}
      </View>
      {party.fullAddress ? (
        <CopyButton value={party.fullAddress} colors={colors} />
      ) : null}
    </View>
  );
}

export default function TransactionDetailScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<TransactionDetailParams, 'TransactionDetail'>>();
  const hideBalance = useHideBalance();
  const money = useMoneyFormat();
  const { contacts, addContact } = useCryptoContacts();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [savingRecipient, setSavingRecipient] = useState(false);
  const [saveRecipientError, setSaveRecipientError] = useState<string | null>(null);

  const tx = route.params?.tx;
  const smartAddress = route.params?.smartAddress ?? '';

  const openExplorer = useCallback(() => {
    if (!tx?.hash) return;
    Linking.openURL(`https://base.blockscout.com/tx/${tx.hash}`).catch(() => undefined);
  }, [tx?.hash]);

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
  const status = getTxStatusDisplay(tx);
  const recipient = getTxRecipientDisplay(tx, contacts, smartAddress);
  const { from, to } = getTxFromToDisplays(tx, contacts, smartAddress);
  const isBridge =
    tx.source === 'fiat_deposit'
    || tx.source === 'crypto_deposit'
    || tx.source === 'fiat_withdraw';
  const displayAmount = hideBalance
    ? HIDDEN_BALANCE_TEXT
    : formatTxListAmount(tx, money.value);
  const detailAmount = hideBalance
    ? HIDDEN_BALANCE_TEXT
    : formatTxDetailAmount(tx, money.value, money.baseCurrency);

  const canSaveRecipient = !!recipient
    && isExternalAddressDisplay(recipient)
    && !!recipient.fullAddress;

  const handleSaveRecipient = async (name: string) => {
    if (!recipient?.fullAddress) return;
    const addr = recipient.fullAddress;
    const duplicate = contacts.some((c) => c.address.toLowerCase() === addr.toLowerCase());
    if (duplicate) {
      setSaveRecipientError(t('card.walletAlreadySaved'));
      return;
    }
    setSaveRecipientError(null);
    setSavingRecipient(true);
    try {
      await addContact({ name, address: addr, chainKey: BASE_CHAIN.key });
    } catch {
      setSaveRecipientError(t('card.failedLoadHistory'));
    } finally {
      setSavingRecipient(false);
    }
  };

  const networkLabel = isBridge ? t('card.txBridgeNetwork') : t('card.txNetworkBase');

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

  const depositPaymentRail = formatDepositPaymentRail(tx.paymentRail);
  const depositPayerLine = formatDepositPayerAccountLine(tx);

  const hasAdvanced =
    feeRows.length > 0
    || !!tx.tokenContract
    || !!tx.bridgeReferenceId
    || !!tx.updatedAt
    || !!(tx.swapFromSymbol && tx.swapToSymbol)
    || !!destinationLabel
    || !!depositPaymentRail
    || !!depositPayerLine
    || !!tx.senderDescription
    || !!tx.hash
    || tx.source === 'chain'
    || isBridge;

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
            <WalletTxIcon tx={tx} size={28} color={accent} />
          </View>
          <Text style={s.heroType}>{typeLabel}</Text>
          <Text style={[s.heroAmount, { color: colors.text }]}>{displayAmount}</Text>
          <View style={[s.statusPill, { backgroundColor: `${status.color}22` }]}>
            {status.pending ? (
              <LoadingDots compact color={status.color} size={6}    />
            ) : (
              <Ionicons name="checkmark-circle" size={14} color={status.color} />
            )}
            <Text style={[s.statusText, { color: status.color }]}>
              {t(status.labelKey)}
            </Text>
          </View>
          <Text style={s.heroDate}>{formatTxFullDate(tx.timestamp)}</Text>
        </View>

        {recipient ? (
          <PartyCard
            title={
              tx.activityKind === 'receive' || tx.direction === 'in'
                ? t('card.txSender')
                : t('card.txRecipient')
            }
            party={recipient}
            colors={colors}
            canSaveRecipient={canSaveRecipient}
            onSaveRecipient={(name) => void handleSaveRecipient(name)}
            savingRecipient={savingRecipient}
            saveError={saveRecipientError}
          />
        ) : null}

        <View style={s.card}>
          <DetailNavRow
            icon="cash-outline"
            iconColor="#60A5FA"
            iconBg="rgba(96,165,250,0.15)"
            label={t('card.txDetailAmount')}
            value={detailAmount}
            colors={colors}
          />
          <DetailNavRow
            icon="ellipse-outline"
            iconColor="#10B981"
            iconBg="rgba(16,185,129,0.15)"
            label={t('card.txProcessedWith')}
            value={formatTxProcessedWith(tx)}
            colors={colors}
          />
          {depositPaymentRail ? (
            <DetailNavRow
              icon="train-outline"
              iconColor="#60A5FA"
              iconBg="rgba(96,165,250,0.15)"
              label={t('card.txDepositPaymentRail')}
              value={depositPaymentRail}
              colors={colors}
            />
          ) : null}
          {depositPayerLine ? (
            <DetailNavRow
              icon="card-outline"
              iconColor="#F59E0B"
              iconBg="rgba(245,158,11,0.15)"
              label={t('card.txDepositPayerAccount')}
              value={depositPayerLine}
              colors={colors}
            />
          ) : null}
          {from ? (
            <DetailNavRow
              icon="wallet-outline"
              iconColor={colors.primary}
              iconBg={colors.primarySoft}
              label={t('card.txFrom')}
              value={from.name}
              subValue={from.addressLine}
              colors={colors}
            />
          ) : null}
          {to ? (
            <DetailNavRow
              icon="person-outline"
              iconColor="#F59E0B"
              iconBg="rgba(245,158,11,0.15)"
              label={t('card.txTo')}
              value={to.name}
              subValue={to.addressLine}
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

        {hasAdvanced ? (
          <>
            <TouchableOpacity
              style={s.advancedToggle}
              onPress={() => setAdvancedOpen((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={s.advancedLabel}>{t('card.txAdvancedDetails')}</Text>
              <Ionicons
                name={advancedOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textMuted}
              />
            </TouchableOpacity>

            {advancedOpen ? (
              <View style={s.card}>
                <DetailNavRow
                  icon="globe-outline"
                  iconColor={colors.textMuted}
                  iconBg={colors.surfaceInput}
                  label={t('card.network')}
                  value={networkLabel}
                  colors={colors}
                />
                {tx.hash ? (
                  <DetailNavRow
                    icon="document-text-outline"
                    iconColor={colors.textMuted}
                    iconBg={colors.surfaceInput}
                    label={t('card.txTransactionHash')}
                    value={truncateAddress(tx.hash)}
                    copyValue={tx.hash}
                    colors={colors}
                  />
                ) : null}
                {tx.swapFromSymbol && tx.swapToSymbol ? (
                  <DetailNavRow
                    icon="swap-horizontal-outline"
                    iconColor={colors.textMuted}
                    iconBg={colors.surfaceInput}
                    label={t('card.txSwapPair')}
                    value={`${tx.swapFromSymbol} → ${tx.swapToSymbol}`}
                    colors={colors}
                  />
                ) : null}
                {destinationLabel ? (
                  <DetailNavRow
                    icon="business-outline"
                    iconColor={colors.textMuted}
                    iconBg={colors.surfaceInput}
                    label={t('card.txDestination')}
                    value={destinationLabel}
                    colors={colors}
                  />
                ) : null}
                {tx.updatedAt ? (
                  <DetailNavRow
                    icon="time-outline"
                    iconColor={colors.textMuted}
                    iconBg={colors.surfaceInput}
                    label={t('card.txUpdated')}
                    value={formatTxFullDate(tx.updatedAt)}
                    colors={colors}
                  />
                ) : null}
                {feeRows.map((row) => (
                  <DetailNavRow
                    key={row.label}
                    icon="receipt-outline"
                    iconColor={colors.textMuted}
                    iconBg={colors.surfaceInput}
                    label={row.label}
                    value={row.value}
                    colors={colors}
                  />
                ))}
                {tx.tokenContract ? (
                  <DetailNavRow
                    icon="code-slash-outline"
                    iconColor={colors.textMuted}
                    iconBg={colors.surfaceInput}
                    label={t('card.txTokenContract')}
                    value={truncateAddress(tx.tokenContract)}
                    copyValue={tx.tokenContract}
                    colors={colors}
                  />
                ) : null}
                {tx.bridgeReferenceId ? (
                  <DetailNavRow
                    icon="key-outline"
                    iconColor={colors.textMuted}
                    iconBg={colors.surfaceInput}
                    label={t('card.txReference')}
                    value={tx.bridgeReferenceId}
                    copyValue={tx.bridgeReferenceId}
                    colors={colors}
                  />
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}

        <View style={s.selfCustodyBox}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
          <Text style={s.selfCustodyText}>{t('card.txSelfCustodyNote')}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function navRowStyles(c: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      gap: 12,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: { flex: 1, gap: 3 },
    label: { color: c.textFaint, fontSize: 11, fontWeight: '600' },
    valueRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    valueText: { color: c.text, fontSize: 15, fontWeight: '600', flexShrink: 1 },
    subValue: { color: c.textFaint, fontSize: 12, fontFamily: 'monospace' },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: c.surfaceInput,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    badgeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#2151F5',
    },
    badgeText: { color: c.textMuted, fontSize: 11, fontWeight: '600' },
  });
}

function partyCardStyles(c: ThemeColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
    },
    copy: { flex: 1, gap: 4 },
    title: { color: c.textFaint, fontSize: 11, fontWeight: '600' },
    name: { color: c.text, fontSize: 16, fontWeight: '700' },
    address: { color: c.textFaint, fontSize: 12, fontFamily: 'monospace', marginTop: 2 },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
      alignSelf: 'flex-start',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: c.primarySoft,
    },
    saveBtnText: { color: c.primary, fontSize: 13, fontWeight: '600' },
    saveForm: { marginTop: 12, gap: 10 },
    nameInput: {
      backgroundColor: c.backgroundElevated,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.borderStrong,
      color: c.text,
      fontSize: 15,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    saveActions: { flexDirection: 'row', gap: 8 },
    cancelBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    cancelBtnText: { color: c.textMuted, fontSize: 14, fontWeight: '600' },
    confirmBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: c.primary,
    },
    confirmBtnDisabled: { opacity: 0.6 },
    confirmBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
    saveError: { color: c.danger, fontSize: 12, marginTop: 6 },
  });
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
    content: { paddingHorizontal: 16, paddingTop: 4, gap: 16 },
    hero: { alignItems: 'center', paddingVertical: 20, gap: 8 },
    heroIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    heroType: { color: c.text, fontSize: 22, fontWeight: '800' },
    heroAmount: { fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      marginTop: 4,
    },
    statusText: { fontSize: 13, fontWeight: '700' },
    heroDate: { color: c.textMuted, fontSize: 13, marginTop: 4 },
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
    },
    explorerText: { color: c.primary, fontSize: 15, fontWeight: '700' },
    advancedToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
    },
    advancedLabel: { color: c.textMuted, fontSize: 14, fontWeight: '600' },
    selfCustodyBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
    },
    selfCustodyText: { color: c.textMuted, fontSize: 13, lineHeight: 19, flex: 1 },
  });
}
