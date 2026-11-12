/**
 * LocalWalletOnboardingScreen — first screen when there is no app backend.
 *
 * There are no accounts in this mode: the user either creates a wallet (a
 * 12-word recovery phrase generated on this device) or imports one they already
 * have. The key never leaves the device, so the phrase is the only backup.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useTranslation } from 'react-i18next';
import LoadingDots from '../../../shared/components/LoadingDots';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { brand } from '../../../config/branding';
import {
  generateRecoveryPhrase,
  installLocalWallet,
  type LocalWalletSecret,
} from '../../../lib/wallet/localWallet';
import RecoveryPhraseGrid from '../components/RecoveryPhraseGrid';

type Step = 'home' | 'create' | 'import';
type ImportKind = LocalWalletSecret['kind'];

const SECRET_SCREEN_CAPTURE_KEY = 'local-wallet-onboarding';

export default function LocalWalletOnboardingScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [step, setStep] = useState<Step>('home');

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      {step === 'home' ? (
        <HomeStep onCreate={() => setStep('create')} onImport={() => setStep('import')} />
      ) : null}
      {step === 'create' ? <CreateStep onBack={() => setStep('home')} /> : null}
      {step === 'import' ? <ImportStep onBack={() => setStep('home')} /> : null}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Home
// ─────────────────────────────────────────────────────────────────────────────

function HomeStep({ onCreate, onImport }: { onCreate: () => void; onImport: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={s.homeWrap}>
      <View style={s.homeHero}>
        <View style={s.heroIcon}>
          <Ionicons name="wallet-outline" size={36} color={colors.primary} />
        </View>
        <Text style={s.title}>{t('localWallet.welcomeTitle', { appName: brand.appName })}</Text>
        <Text style={s.subtitle}>{t('localWallet.welcomeSubtitle')}</Text>
      </View>

      <View>
        <TouchableOpacity style={s.primaryBtn} activeOpacity={0.85} onPress={onCreate}>
          <Text style={s.primaryBtnText}>{t('localWallet.createCta')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.secondaryBtn} activeOpacity={0.85} onPress={onImport}>
          <Text style={s.secondaryBtnText}>{t('localWallet.importCta')}</Text>
        </TouchableOpacity>
        <Text style={s.footnote}>{t('localWallet.selfCustodyNote')}</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Create — show the phrase, require an explicit "I wrote it down"
// ─────────────────────────────────────────────────────────────────────────────

function CreateStep({ onBack }: { onBack: () => void }) {
  usePreventScreenCapture(SECRET_SCREEN_CAPTURE_KEY);
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  // Generated once per visit and kept in memory only until the user confirms.
  const [phrase] = useState(() => generateRecoveryPhrase());
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = useCallback(async () => {
    if (!confirmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      // On success the wallet store flips to "present" and the app leaves this screen.
      await installLocalWallet({ kind: 'mnemonic', phrase });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('localWallet.saveFailed'));
      setSaving(false);
    }
  }, [confirmed, saving, phrase, t]);

  return (
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      <StepHeader title={t('localWallet.createTitle')} onBack={saving ? undefined : onBack} />

      <View style={s.warningCard}>
        <Ionicons name="warning-outline" size={20} color={colors.warning} />
        <Text style={s.warningText}>{t('localWallet.phraseWarning')}</Text>
      </View>

      <RecoveryPhraseGrid phrase={phrase} />

      <TouchableOpacity
        style={s.checkRow}
        activeOpacity={0.7}
        onPress={() => setConfirmed((v) => !v)}
        disabled={saving}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: confirmed }}
      >
        <Ionicons
          name={confirmed ? 'checkbox' : 'square-outline'}
          size={22}
          color={confirmed ? colors.primary : colors.textMuted}
        />
        <Text style={s.checkText}>{t('localWallet.phraseConfirm')}</Text>
      </TouchableOpacity>

      {error ? <Text style={s.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[s.primaryBtn, (!confirmed || saving) && s.btnDisabled]}
        activeOpacity={0.85}
        onPress={() => void handleContinue()}
        disabled={!confirmed || saving}
      >
        {saving ? (
          <LoadingDots compact color={colors.textInverse} size={6} />
        ) : (
          <Text style={s.primaryBtnText}>{t('localWallet.createConfirmCta')}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Import — recovery phrase or private key
// ─────────────────────────────────────────────────────────────────────────────

function ImportStep({ onBack }: { onBack: () => void }) {
  usePreventScreenCapture(SECRET_SCREEN_CAPTURE_KEY);
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [kind, setKind] = useState<ImportKind>('mnemonic');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = value.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const looksComplete =
    kind === 'mnemonic'
      ? wordCount === 12 || wordCount === 24
      : /^(0x)?[0-9a-fA-F]{64}$/.test(trimmed);

  const handleKind = (next: ImportKind) => {
    if (next === kind) return;
    setKind(next);
    setValue('');
    setError(null);
  };

  const handleImport = useCallback(async () => {
    if (!looksComplete || saving) return;
    setSaving(true);
    setError(null);
    try {
      const secret: LocalWalletSecret =
        kind === 'mnemonic'
          ? { kind: 'mnemonic', phrase: trimmed }
          : { kind: 'privateKey', privateKey: trimmed };
      await installLocalWallet(secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('localWallet.saveFailed'));
      setSaving(false);
    }
  }, [looksComplete, saving, kind, trimmed, t]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StepHeader title={t('localWallet.importTitle')} onBack={saving ? undefined : onBack} />

        <View style={s.segment}>
          {(['mnemonic', 'privateKey'] as const).map((option) => (
            <TouchableOpacity
              key={option}
              style={[s.segmentBtn, kind === option && s.segmentBtnActive]}
              activeOpacity={0.8}
              onPress={() => handleKind(option)}
              disabled={saving}
            >
              <Text style={[s.segmentText, kind === option && s.segmentTextActive]}>
                {option === 'mnemonic'
                  ? t('localWallet.importPhraseTab')
                  : t('localWallet.importKeyTab')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={s.input}
          value={value}
          onChangeText={(text) => {
            setValue(text);
            setError(null);
          }}
          placeholder={
            kind === 'mnemonic'
              ? t('localWallet.importPhrasePlaceholder')
              : t('localWallet.importKeyPlaceholder')
          }
          placeholderTextColor={colors.textFaint}
          multiline
          editable={!saving}
          // Keep the secret out of keyboard learning, autofill and suggestions.
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          importantForAutofill="no"
          textContentType="none"
          keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'}
        />

        <Text style={s.hint}>
          {kind === 'mnemonic'
            ? t('localWallet.importPhraseHint')
            : t('localWallet.importKeyHint', { appName: brand.appName })}
        </Text>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[s.primaryBtn, (!looksComplete || saving) && s.btnDisabled]}
          activeOpacity={0.85}
          onPress={() => void handleImport()}
          disabled={!looksComplete || saving}
        >
          {saving ? (
            <LoadingDots compact color={colors.textInverse} size={6} />
          ) : (
            <Text style={s.primaryBtnText}>{t('localWallet.importConfirmCta')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function StepHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={s.header}>
      <TouchableOpacity
        onPress={onBack}
        disabled={!onBack}
        style={[s.backBtn, !onBack && { opacity: 0.4 }]}
        hitSlop={8}
        accessibilityRole="button"
      >
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </TouchableOpacity>
      <Text style={s.headerTitle}>{title}</Text>
      <View style={s.backBtn} />
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    homeWrap: { flex: 1, paddingHorizontal: 24, paddingBottom: 24, justifyContent: 'space-between' },
    homeHero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    heroIcon: {
      width: 76,
      height: 76,
      borderRadius: 24,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    title: { color: c.text, fontSize: 26, fontWeight: '700', textAlign: 'center' },
    subtitle: {
      color: c.textMuted,
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
      marginTop: 12,
      paddingHorizontal: 8,
    },
    scroll: { paddingHorizontal: 24, paddingBottom: 32 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      marginBottom: 12,
    },
    headerTitle: { color: c.text, fontSize: 17, fontWeight: '600' },
    backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    warningCard: {
      flexDirection: 'row',
      gap: 10,
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      marginBottom: 16,
    },
    warningText: { flex: 1, color: c.text, fontSize: 13, lineHeight: 19 },
    checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 20, marginBottom: 20 },
    checkText: { flex: 1, color: c.text, fontSize: 14, lineHeight: 20 },
    primaryBtn: {
      backgroundColor: c.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 54,
    },
    primaryBtnText: { color: c.textInverse, fontSize: 16, fontWeight: '600' },
    secondaryBtn: {
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.borderStrong,
      marginTop: 12,
    },
    secondaryBtnText: { color: c.text, fontSize: 16, fontWeight: '600' },
    btnDisabled: { opacity: 0.45 },
    footnote: { color: c.textFaint, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 16 },
    segment: {
      flexDirection: 'row',
      backgroundColor: c.surfaceInput,
      borderRadius: 12,
      padding: 4,
      marginBottom: 16,
    },
    segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
    segmentBtnActive: { backgroundColor: c.surface },
    segmentText: { color: c.textMuted, fontSize: 14, fontWeight: '500' },
    segmentTextActive: { color: c.text, fontWeight: '600' },
    input: {
      minHeight: 120,
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      color: c.text,
      fontSize: 15,
      lineHeight: 22,
      textAlignVertical: 'top',
    },
    hint: { color: c.textMuted, fontSize: 13, lineHeight: 19, marginTop: 12, marginBottom: 20 },
    error: { color: c.danger, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  });
}
