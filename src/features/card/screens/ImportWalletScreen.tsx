import LoadingDots from '../../../shared/components/LoadingDots';
/**
 * ImportWalletScreen
 *
 * Lets the user import an existing wallet via BIP-39 mnemonic.
 *
 * Two modes:
 *   bip44 — standard HD derivation m/44'/60'/0'/0/0  (MetaMask, hardware wallets)
 *   kura  — raw entropy exported by Kura's "Export Wallet Key" screen
 *
 * The derived private key is stored in expo-secure-store under
 * WALLET_IMPORTED_KEY.  The hook picks it up on the next render.
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { privateKeyFromMnemonic, ImportMnemonicType, buildSmartAccountClient } from '../hooks/useKuraCardWallet';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useHeaderHeight } from '../../../shared/navigation/Header';

interface ImportWalletScreenProps {
  onClose: () => void;
  onImport: (phrase: string, type: ImportMnemonicType) => Promise<void>;
}

export default function ImportWalletScreen({ onClose, onImport }: ImportWalletScreenProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const headerHeight = useHeaderHeight();
  const [importType, setImportType] = useState<ImportMnemonicType>('bip44');
  const [phrase, setPhrase] = useState('');
  const [previewAddress, setPreviewAddress] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPhrase, setShowPhrase] = useState(false);

  const previewTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wordCount = phrase.trim().split(/\s+/).filter(Boolean).length;
  const isReady = (wordCount === 12 || wordCount === 24) && !isImporting;

  // ── Live address preview (debounced) ────────────────────────────────────────
  const triggerPreview = useCallback(
    (text: string, type: ImportMnemonicType) => {
      if (previewTimeout.current) clearTimeout(previewTimeout.current);
      setPreviewAddress(null);
      setError(null);

      const words = text.trim().split(/\s+/).filter(Boolean).length;
      if (words !== 12 && words !== 24) return;

      previewTimeout.current = setTimeout(async () => {
        setIsPreviewLoading(true);
        try {
          const { privateKeyToAccount } = require('viem/accounts') as typeof import('viem/accounts');
          const { toSimpleSmartAccount } = require('permissionless/accounts') as typeof import('permissionless/accounts');
          const { createPublicClient } = require('viem') as typeof import('viem');
          const { base } = require('viem/chains') as typeof import('viem/chains');
          const { createBaseTransport, PIMLICO_URL: _, entryPoint07Address: __ } = require('../config/cardWalletConfig');

          const privKey = privateKeyFromMnemonic(text.trim(), type);
          const owner = privateKeyToAccount(`0x${privKey}` as `0x${string}`);
          const { entryPoint07Address } = require('viem/account-abstraction') as typeof import('viem/account-abstraction');
          const client = createPublicClient({ chain: base, transport: createBaseTransport() });
          const account = await toSimpleSmartAccount({
            client,
            owner,
            entryPoint: { address: entryPoint07Address, version: '0.7' as const },
          });
          setPreviewAddress(account.address);
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : t('card.invalidMnemonic'));
          setPreviewAddress(null);
        } finally {
          setIsPreviewLoading(false);
        }
      }, 600);
    },
    [t],
  );

  const handlePhraseChange = useCallback(
    (text: string) => {
      setPhrase(text);
      triggerPreview(text, importType);
    },
    [importType, triggerPreview],
  );

  const handleTypeChange = useCallback(
    (type: ImportMnemonicType) => {
      setImportType(type);
      triggerPreview(phrase, type);
    },
    [phrase, triggerPreview],
  );

  const handleImport = useCallback(async () => {
    if (!isReady) return;
    setIsImporting(true);
    setError(null);
    try {
      await onImport(phrase.trim(), importType);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('card.importFailed'));
    } finally {
      setIsImporting(false);
    }
  }, [isReady, onImport, phrase, importType, onClose, t]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, { paddingTop: headerHeight + 8 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.textMuted} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{t('card.importWallet')}</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Type selector */}
        <Text style={s.sectionLabel}>{t('card.walletType')}</Text>
        <View style={s.typeSelector}>
          {([
            { id: 'bip44', label: t('card.externalWallet'), sub: t('card.externalWalletSub') },
            { id: 'kura',  label: t('card.kuraBackup'),     sub: t('card.kuraBackupSub') },
          ] as { id: ImportMnemonicType; label: string; sub: string }[]).map(({ id, label, sub }) => (
            <TouchableOpacity
              key={id}
              onPress={() => handleTypeChange(id)}
              style={[s.typeCard, importType === id && s.typeCardActive]}
            >
              <View style={s.typeRadio}>
                {importType === id && <View style={s.typeRadioDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.typeLabel, importType === id && s.typeLabelActive]}>{label}</Text>
                <Text style={s.typeSub}>{sub}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Mnemonic input */}
        <Text style={s.sectionLabel}>{t('card.seedPhrase')}</Text>
        <View style={s.inputWrapper}>
          <TextInput
            style={s.mnemonicInput}
            placeholder={
              importType === 'bip44'
                ? t('card.seedPhrasePlaceholderBip44')
                : t('card.seedPhrasePlaceholderKura')
            }
            placeholderTextColor={colors.textFaint}
            value={showPhrase ? phrase : phrase.replace(/\S+/g, '•••')}
            onChangeText={handlePhraseChange}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            secureTextEntry={false}
            keyboardType="default"
          />
          <TouchableOpacity
            onPress={() => setShowPhrase((v) => !v)}
            style={s.eyeBtn}
          >
            <Ionicons
              name={showPhrase ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        {/* Word count badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <View
            style={[
              s.wordBadge,
              wordCount === 12 || wordCount === 24
                ? s.wordBadgeOk
                : wordCount > 0
                ? s.wordBadgeWarn
                : {},
            ]}
          >
            <Text style={s.wordBadgeText}>
              {wordCount} {wordCount !== 1 ? t('card.words') : t('card.word')}
            </Text>
          </View>
          {importType === 'bip44' && (
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('card.wordsRequired1224')}</Text>
          )}
          {importType === 'kura' && (
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('card.words24Required')}</Text>
          )}
        </View>

        {/* Address preview */}
        {(isPreviewLoading || previewAddress) && (
          <View style={s.previewCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Ionicons name="cube-outline" size={14} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {t('card.smartAccountBase')}
              </Text>
            </View>
            {isPreviewLoading ? (
              <LoadingDots compact color={colors.primary} size={6}    />
            ) : (
              <Text style={s.previewAddress} selectable>
                {previewAddress}
              </Text>
            )}
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={s.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {/* Warning */}
        <View style={s.warningBanner}>
          <Ionicons name="lock-closed-outline" size={14} color="#FCD34D" />
          <Text style={s.warningText}>
            {t('card.seedPhraseStoredNote')}
          </Text>
        </View>

        {/* Import button */}
        <TouchableOpacity
          onPress={handleImport}
          disabled={!isReady}
          style={{ borderRadius: 14, overflow: 'hidden', marginTop: 8, opacity: isReady ? 1 : 0.4 }}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#7C3AED', '#4F46E5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.importGradient}
          >
            {isImporting ? (
              <LoadingDots color="#fff" size={8}   />
            ) : (
              <>
                <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                <Text style={s.importBtnText}>{t('card.importWallet')}</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    scroll: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 48 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
    backBtn: { width: 36, height: 36, backgroundColor: c.surface, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: c.text, fontSize: 20, fontWeight: '700' },
    sectionLabel: { color: c.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
    typeSelector: { gap: 8, marginBottom: 24 },
    typeCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: c.surface, borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: c.borderStrong,
    },
    typeCardActive: { borderColor: c.primary, backgroundColor: 'rgba(139,92,246,0.08)' },
    typeRadio: {
      width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: c.textMuted,
      alignItems: 'center', justifyContent: 'center',
    },
    typeRadioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary },
    typeLabel: { color: c.textMuted, fontWeight: '600', fontSize: 14 },
    typeLabelActive: { color: c.text },
    typeSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    inputWrapper: {
      backgroundColor: c.surface, borderRadius: 12, borderWidth: 1,
      borderColor: c.borderStrong, marginBottom: 10, position: 'relative',
    },
    mnemonicInput: {
      color: c.text, fontSize: 14, lineHeight: 22, padding: 14,
      paddingRight: 44, minHeight: 100, textAlignVertical: 'top',
    },
    eyeBtn: { position: 'absolute', right: 12, top: 14 },
    wordBadge: {
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderStrong,
    },
    wordBadgeOk: { borderColor: 'rgba(52,211,153,0.4)', backgroundColor: 'rgba(52,211,153,0.08)' },
    wordBadgeWarn: { borderColor: 'rgba(245,158,11,0.4)', backgroundColor: 'rgba(245,158,11,0.08)' },
    wordBadgeText: { color: c.text, fontSize: 12, fontWeight: '600' },
    previewCard: {
      backgroundColor: 'rgba(139,92,246,0.08)', borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: c.primarySoft, marginBottom: 16,
    },
    previewAddress: { color: c.text, fontSize: 13, fontFamily: 'monospace' },
    errorBanner: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 10, padding: 12,
      borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', marginBottom: 16,
    },
    errorText: { color: c.danger, fontSize: 13, flex: 1, lineHeight: 18 },
    warningBanner: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      backgroundColor: 'rgba(245,158,11,0.07)', borderRadius: 10, padding: 12,
      borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)', marginBottom: 20,
    },
    warningText: { color: '#FCD34D', fontSize: 12, flex: 1, lineHeight: 18 },
    importGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
    importBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  });
}
