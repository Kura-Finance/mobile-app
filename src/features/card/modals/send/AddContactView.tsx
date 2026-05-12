import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  ChainOption, CryptoContact, shortenAddress,
} from '../../hooks/useCryptoContacts';
import { makeModalStyles } from '../modalStyles';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import { extractAddress } from './PickerView';
import ChainLogo from '../../components/ChainLogo';

interface Props {
  contacts: CryptoContact[];
  chain: ChainOption;
  prefillAddress?: string;
  onScanQR: () => void;
  onBackToChain: () => void;
  onContinue: (params: { name: string; address: string; chainKey: string }) => void;
}

export default function AddContactView({
  contacts, chain, prefillAddress = '', onScanQR, onBackToChain, onContinue,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeModalStyles(colors), [colors]);
  const st = useMemo(() => makeStyles(colors), [colors]);
  const [address, setAddress] = useState(prefillAddress);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setAddress(prefillAddress);
  }, [prefillAddress]);

  const parsedAddress = useMemo(() => extractAddress(address), [address]);
  const isBridge = chain.key !== 'BASE';
  const displayName = name.trim() || (parsedAddress ? shortenAddress(parsedAddress) : '');

  const handleContinue = () => {
    const addr = extractAddress(address);
    if (!addr) { setError(t('card.enterValidAddress')); return; }

    const duplicate = contacts.some((c) => c.address.toLowerCase() === addr.toLowerCase());
    if (duplicate) { setError(t('card.walletAlreadySaved')); return; }

    setError('');
    onContinue({ name: name.trim(), address: addr, chainKey: chain.key });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView
        style={st.scroll}
        contentContainerStyle={st.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={st.subtitle}>{t('card.addWalletSubtitle')}</Text>

        {/* Selected network (read-only) */}
        <Text style={s.fieldLabel}>{t('card.network')}</Text>
        <View style={st.chainSummary}>
          <View style={[st.chainSummaryIcon, { backgroundColor: `${chain.color}14` }]}>
            <ChainLogo chain={chain} size={28} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.chainSummaryName}>{chain.name}</Text>
            <Text style={st.chainSummarySub}>
              {isBridge ? t('card.bridgeViaLifi') : t('card.baseDirectSend')}
            </Text>
          </View>
          {isBridge && <Text style={st.bridgeBadge}>{t('card.bridge')}</Text>}
        </View>

        {/* Form card */}
        <View style={st.formCard}>
          <View style={st.fieldBlock}>
            <Text style={s.fieldLabel}>{t('card.walletAddress')}</Text>
            <View style={[
              st.addressWrap,
              parsedAddress ? st.addressWrapValid : undefined,
              error && !parsedAddress ? st.addressWrapError : undefined,
            ]}>
              <TextInput
                style={st.addressInput}
                placeholder="0x…"
                placeholderTextColor={colors.textFaint}
                value={address}
                onChangeText={(v) => { setAddress(v); setError(''); }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {parsedAddress ? (
                <Ionicons name="checkmark-circle" size={18} color="#22C55E" style={st.validIcon} />
              ) : null}
              <TouchableOpacity
                onPress={onScanQR}
                style={st.qrBtn}
                activeOpacity={0.7}
                accessibilityLabel={t('card.scanQrToAdd')}
              >
                <Ionicons name="qr-code-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={st.divider} />

          <View style={[st.fieldBlock, { marginBottom: 0 }]}>
            <Text style={s.fieldLabel}>{t('card.nameOptional')}</Text>
            <TextInput
              style={st.nameInput}
              placeholder={t('card.namePlaceholder')}
              placeholderTextColor={colors.textFaint}
              value={name}
              onChangeText={setName}
            />
          </View>
        </View>

        {parsedAddress ? (
          <View style={st.previewSection}>
            <Text style={st.previewLabel}>{t('card.previewContact')}</Text>
            <View style={[st.previewCard, { borderLeftColor: chain.color }]}>
              <View style={[st.previewIcon, { backgroundColor: `${chain.color}22` }]}>
                <Ionicons name="wallet-outline" size={20} color={chain.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.previewName}>{displayName}</Text>
                <View style={st.previewMeta}>
                  <View style={[st.previewDot, { backgroundColor: chain.color }]} />
                  <Text style={st.previewAddr} numberOfLines={1} ellipsizeMode="middle">
                    {parsedAddress}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {error ? (
          <View style={st.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={st.errorBoxText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={handleContinue}
          style={[s.primaryBtn, { marginTop: 8 }]}
          activeOpacity={0.85}
          disabled={!parsedAddress}
        >
          <LinearGradient
            colors={parsedAddress ? ['#5B21B6', '#7C3AED'] : ['#374151', '#4B5563']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.primaryBtnGradient}
          >
            <Ionicons name="bookmark-outline" size={17} color="#FFF" />
            <Text style={s.primaryBtnText}>{t('card.saveAndContinue')}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={s.networkNote}>
          {isBridge ? t('card.addWalletBridgeHint') : t('card.addWalletBaseHint')}
        </Text>

        <TouchableOpacity style={st.backLink} onPress={onBackToChain} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={15} color={colors.primary} />
          <Text style={st.backLinkText}>{t('card.backToNetwork')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: c.backgroundElevated },
    content: { paddingHorizontal: 24, paddingTop: 0, paddingBottom: 64 },
    subtitle: {
      color: c.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 20,
    },

    chainSummary: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 20,
      borderWidth: 1, borderColor: c.border,
    },
    chainSummaryIcon: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
    },
    chainSummaryName: { color: c.text, fontSize: 15, fontWeight: '600' },
    chainSummarySub: { color: c.textMuted, fontSize: 12, marginTop: 1 },
    bridgeBadge: {
      fontSize: 11, fontWeight: '600', color: '#F59E0B',
      backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 6,
      paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden',
    },

    formCard: {
      backgroundColor: c.surface, borderRadius: 16, overflow: 'hidden',
      borderWidth: 1, borderColor: c.border, marginBottom: 20,
    },
    fieldBlock: { paddingHorizontal: 16, paddingVertical: 14 },
    divider: {
      height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginHorizontal: 16,
    },

    addressWrap: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.backgroundElevated, borderRadius: 12,
      borderWidth: 1, borderColor: c.borderStrong, paddingRight: 4,
    },
    addressWrapValid: { borderColor: 'rgba(34,197,94,0.45)' },
    addressWrapError: { borderColor: 'rgba(239,68,68,0.45)' },
    addressInput: {
      flex: 1, color: c.text, fontSize: 14,
      paddingHorizontal: 14, paddingVertical: 14,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    validIcon: { marginRight: 2 },
    qrBtn: {
      width: 40, height: 44,
      alignItems: 'center', justifyContent: 'center',
    },

    nameInput: {
      backgroundColor: c.backgroundElevated, borderRadius: 12,
      borderWidth: 1, borderColor: c.borderStrong,
      color: c.text, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12,
    },

    previewSection: { marginBottom: 16 },
    previewLabel: {
      color: c.textFaint, fontSize: 12, fontWeight: '600', letterSpacing: 0.4,
      textTransform: 'uppercase', marginBottom: 10,
    },
    previewCard: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1, borderLeftWidth: 3, borderColor: c.borderStrong, padding: 14,
    },
    previewIcon: {
      width: 40, height: 40, borderRadius: 20,
      alignItems: 'center', justifyContent: 'center',
    },
    previewName: { color: c.text, fontSize: 15, fontWeight: '600', marginBottom: 4 },
    previewMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    previewDot: { width: 6, height: 6, borderRadius: 3 },
    previewAddr: {
      color: c.textMuted, fontSize: 12, flex: 1,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },

    errorBox: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 12,
      borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
      paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12,
    },
    errorBoxText: { color: c.danger, fontSize: 13, flex: 1, lineHeight: 18 },

    backLink: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: 12, marginTop: 4,
    },
    backLinkText: { color: c.primary, fontSize: 14, fontWeight: '600' },
  });
}
