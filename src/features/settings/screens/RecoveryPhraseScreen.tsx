/**
 * RecoveryPhraseScreen — back up the wallet stored on this device.
 *
 * Only used without an app backend (with one, the key is held by Privy and
 * ExportWalletKeyScreen explains how to export it). Reveal is gated by the app
 * lock (biometrics / App PIN) and screenshots are blocked while it is open.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LoadingDots from '../../../shared/components/LoadingDots';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';
import { useLocalAuthGate } from '../../../shared/hooks/useLocalAuthGate';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { readRecoverySecret, useLocalWalletStore } from '../../../lib/wallet/localWallet';
import { useKuraCardWallet } from '../../card/context/KuraCardWalletContext';
import RecoveryPhraseGrid from '../../auth/components/RecoveryPhraseGrid';

interface Props {
  onClose: () => void;
}

type RevealState =
  | { status: 'locked'; message?: string }
  | { status: 'loading' }
  | { status: 'revealed'; phrase: string | null; privateKey: string };

export default function RecoveryPhraseScreen({ onClose }: Props) {
  usePreventScreenCapture('local-wallet-recovery');
  const insets = useSafeAreaInsets();
  const { t } = useAppTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { requireLocalAuth } = useLocalAuthGate();
  const { smartAddress } = useKuraCardWallet();
  const eoaAddress = useLocalWalletStore((state) => state.eoaAddress);

  const [reveal, setReveal] = useState<RevealState>({ status: 'locked' });
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState<'phrase' | 'key' | null>(null);

  const handleReveal = useCallback(async () => {
    setReveal({ status: 'loading' });
    const gate = await requireLocalAuth('localWallet.revealPrompt');
    if (!gate.allowed) {
      setReveal({ status: 'locked', message: gate.message });
      return;
    }
    try {
      const secret = await readRecoverySecret();
      if (!secret) {
        setReveal({ status: 'locked', message: t('localWallet.keyMissing') });
        return;
      }
      setReveal({ status: 'revealed', ...secret });
    } catch (err) {
      setReveal({
        status: 'locked',
        message: err instanceof Error ? err.message : t('localWallet.revealFailed'),
      });
    }
  }, [requireLocalAuth, t]);

  // Drop the secret from memory when the screen goes away.
  useEffect(() => () => setReveal({ status: 'locked' }), []);

  const copy = useCallback(async (kind: 'phrase' | 'key', value: string) => {
    await Clipboard.setStringAsync(value);
    setCopied(kind);
    setTimeout(() => setCopied((current) => (current === kind ? null : current)), 2000);
  }, []);

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <Text style={s.headerTitle}>{t('localWallet.backupTitle')}</Text>
          <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={s.warningCard}>
          <Ionicons name="warning-outline" size={20} color={colors.warning} />
          <Text style={s.warningText}>{t('localWallet.backupWarning')}</Text>
        </View>

        {reveal.status === 'revealed' ? (
          <>
            {reveal.phrase ? (
              <>
                <Text style={s.sectionTitle}>{t('localWallet.phraseLabel')}</Text>
                <RecoveryPhraseGrid phrase={reveal.phrase} />
                <TouchableOpacity
                  style={s.copyBtn}
                  activeOpacity={0.8}
                  onPress={() => void copy('phrase', reveal.phrase as string)}
                >
                  <Ionicons
                    name={copied === 'phrase' ? 'checkmark' : 'copy-outline'}
                    size={16}
                    color={colors.text}
                  />
                  <Text style={s.copyText}>
                    {copied === 'phrase' ? t('localWallet.copied') : t('localWallet.copyPhrase')}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={s.note}>{t('localWallet.noPhraseNote')}</Text>
            )}

            <Text style={[s.sectionTitle, { marginTop: 24 }]}>{t('localWallet.keyLabel')}</Text>
            {showKey ? (
              <>
                <View style={s.keyBox}>
                  <Text style={s.keyText} selectable={false}>
                    0x{reveal.privateKey}
                  </Text>
                </View>
                <TouchableOpacity
                  style={s.copyBtn}
                  activeOpacity={0.8}
                  onPress={() => void copy('key', `0x${reveal.privateKey}`)}
                >
                  <Ionicons
                    name={copied === 'key' ? 'checkmark' : 'copy-outline'}
                    size={16}
                    color={colors.text}
                  />
                  <Text style={s.copyText}>
                    {copied === 'key' ? t('localWallet.copied') : t('localWallet.copyKey')}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={s.copyBtn} activeOpacity={0.8} onPress={() => setShowKey(true)}>
                <Ionicons name="eye-outline" size={16} color={colors.text} />
                <Text style={s.copyText}>{t('localWallet.showKey')}</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            {reveal.status === 'locked' && reveal.message ? (
              <Text style={s.error}>{reveal.message}</Text>
            ) : null}
            <TouchableOpacity
              style={[s.primaryBtn, reveal.status === 'loading' && { opacity: 0.6 }]}
              activeOpacity={0.85}
              onPress={() => void handleReveal()}
              disabled={reveal.status === 'loading'}
            >
              {reveal.status === 'loading' ? (
                <LoadingDots compact color={colors.textInverse} size={6} />
              ) : (
                <Text style={s.primaryBtnText}>{t('localWallet.revealCta')}</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        <View style={s.infoCard}>
          <Text style={s.infoTitle}>{t('localWallet.recoverTitle')}</Text>
          <Text style={s.infoBody}>{t('localWallet.recoverBody')}</Text>
          {smartAddress ? (
            <AddressRow label={t('walletHowItWorks.smartAccount')} value={smartAddress} styles={s} />
          ) : null}
          {eoaAddress ? (
            <AddressRow label={t('walletHowItWorks.signerEoa')} value={eoaAddress} styles={s} />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function AddressRow({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.addrRow}>
      <Text style={styles.addrLabel}>{label}</Text>
      <Text style={styles.addrValue} selectable>
        {value}
      </Text>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    scroll: { paddingHorizontal: 24, paddingBottom: 48 },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    headerTitle: { color: c.text, fontSize: 20, fontWeight: 'bold' },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    warningCard: {
      flexDirection: 'row',
      gap: 10,
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      marginBottom: 20,
    },
    warningText: { flex: 1, color: c.text, fontSize: 13, lineHeight: 19 },
    sectionTitle: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
      marginBottom: 12,
    },
    note: { color: c.textMuted, fontSize: 13, lineHeight: 19 },
    keyBox: {
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
    },
    keyText: { color: c.text, fontSize: 13, lineHeight: 20, fontFamily: 'Courier' },
    copyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.borderStrong,
      paddingVertical: 12,
      marginTop: 12,
    },
    copyText: { color: c.text, fontSize: 14, fontWeight: '500' },
    primaryBtn: {
      backgroundColor: c.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 54,
    },
    primaryBtnText: { color: c.textInverse, fontSize: 16, fontWeight: '600' },
    error: { color: c.danger, fontSize: 13, lineHeight: 19, marginBottom: 12 },
    infoCard: {
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
      marginTop: 28,
    },
    infoTitle: { color: c.text, fontSize: 15, fontWeight: '600', marginBottom: 8 },
    infoBody: { color: c.textMuted, fontSize: 13, lineHeight: 20 },
    addrRow: { marginTop: 14 },
    addrLabel: { color: c.textFaint, fontSize: 12, marginBottom: 4 },
    addrValue: { color: c.text, fontSize: 13, fontFamily: 'Courier' },
  });
}
