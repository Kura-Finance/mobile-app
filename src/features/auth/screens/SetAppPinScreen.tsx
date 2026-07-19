import LoadingDots from '../../../shared/components/LoadingDots';
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  Alert,
  Keyboard,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PinInput from '../components/PinInput';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { APP_PIN_LENGTH, isValidPinFormat, pinsMatch } from '../../../lib/security/appPinCore';
import { verifyAppPin } from '../../../lib/security/appPin';
import { appPinFailureMessage } from '../../../lib/security/authErrorMessages';

const CARD_LOGO = require('../../../../assets/card.webp');

type Step = 'create' | 'confirm' | 'verifyCurrent';

interface Props {
  mode?: 'overlay' | 'standalone';
  changeMode?: boolean;
  required?: boolean;
  submitting?: boolean;
  error?: string;
  showBack?: boolean;
  onSubmit: (pin: string, currentPin?: string) => void | Promise<void>;
  onBack?: () => void;
  onCancel?: () => void;
  onForgotPin?: () => void;
}

export default function SetAppPinScreen({
  mode = 'standalone',
  changeMode = false,
  required = false,
  submitting = false,
  error,
  showBack = true,
  onSubmit,
  onBack,
  onCancel,
  onForgotPin,
}: Props) {
  const { colors, scheme } = useTheme();
  const { t } = useAppTranslation();
  const [step, setStep] = useState<Step>(changeMode ? 'verifyCurrent' : 'create');
  const [currentPin, setCurrentPin] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [localError, setLocalError] = useState('');
  const [checkingCurrent, setCheckingCurrent] = useState(false);
  const st = useMemo(() => makeStyles(colors, scheme, mode), [colors, scheme, mode]);
  const statusBarStyle = scheme === 'light' ? 'dark' : 'light';

  const activeValue =
    step === 'verifyCurrent' ? currentPin : step === 'create' ? pin : confirmPin;

  const title =
    step === 'verifyCurrent'
      ? t('auth.verifyCurrentPinTitle')
      : step === 'create'
        ? t('auth.setAppPinTitle')
        : t('auth.confirmAppPinTitle');

  const subtitle =
    step === 'verifyCurrent'
      ? t('auth.verifyCurrentPinSubtitle')
      : step === 'create'
        ? t('auth.setAppPinSubtitle')
        : t('auth.confirmAppPinSubtitle');

  const busy = submitting || checkingCurrent;
  const canContinue = activeValue.length === APP_PIN_LENGTH && !busy;
  const displayError = error || localError;

  const handleActiveChange = useCallback(
    (value: string) => {
      setLocalError('');
      if (step === 'verifyCurrent') setCurrentPin(value);
      else if (step === 'create') setPin(value);
      else setConfirmPin(value);
    },
    [step],
  );

  const handleContinue = async () => {
    if (!canContinue) return;
    setLocalError('');
    Keyboard.dismiss();

    if (step === 'verifyCurrent') {
      setCheckingCurrent(true);
      try {
        const result = await verifyAppPin(currentPin);
        if (!result.ok) {
          setLocalError(appPinFailureMessage(result.reason ?? 'failed', t));
          setCurrentPin('');
          return;
        }
        setStep('create');
      } finally {
        setCheckingCurrent(false);
      }
      return;
    }

    if (step === 'create') {
      if (!isValidPinFormat(pin)) return;
      setStep('confirm');
      return;
    }

    if (!pinsMatch(pin, confirmPin)) {
      setLocalError(t('auth.appPinMismatch'));
      setConfirmPin('');
      setPin('');
      setStep('create');
      return;
    }

    void onSubmit(pin, changeMode ? currentPin : undefined);
  };

  const handleBack = () => {
    if (step === 'confirm') {
      setConfirmPin('');
      setStep('create');
      return;
    }
    if (step === 'create' && changeMode) {
      setPin('');
      setStep('verifyCurrent');
      return;
    }
    onBack?.();
  };

  const handleForgotPin = () => {
    Alert.alert(t('auth.forgotAppPinTitle'), t('auth.forgotAppPinMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('auth.forgotAppPinConfirm'),
        style: 'destructive',
        onPress: () => onForgotPin?.(),
      },
    ]);
  };

  const content = (
    <SafeAreaView style={st.safeArea} edges={['top', 'bottom']}>
      <View style={st.content}>
        {showBack && !required && (onBack || step !== (changeMode ? 'verifyCurrent' : 'create')) ? (
          <TouchableOpacity onPress={handleBack} style={st.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        ) : (
          <View style={st.backBtnPlaceholder} />
        )}

        <View style={st.branding}>
          <Image source={CARD_LOGO} style={st.logo} resizeMode="contain" />
          <Text style={st.title}>{title}</Text>
          <Text style={st.subtitle}>{subtitle}</Text>
        </View>

        <PinInput value={activeValue} onChange={handleActiveChange} editable={!busy} />

        {displayError ? <Text style={st.error}>{displayError}</Text> : null}

        <View style={st.spacer} />

        <TouchableOpacity
          onPress={handleContinue}
          disabled={!canContinue}
          style={[st.primaryBtn, !canContinue && st.primaryBtnDisabled]}
          activeOpacity={0.85}
        >
          {busy ? (
            <LoadingDots compact color="#FFFFFF" size={6} />
          ) : (
            <Text style={st.primaryBtnText}>
              {step === 'confirm' ? t('auth.saveAppPin') : t('auth.continue')}
            </Text>
          )}
        </TouchableOpacity>

        {onCancel && !required ? (
          <TouchableOpacity onPress={onCancel} style={st.cancelBtn} activeOpacity={0.7}>
            <Text style={st.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        ) : null}

        {changeMode && onForgotPin ? (
          <TouchableOpacity onPress={handleForgotPin} style={st.forgotBtn} activeOpacity={0.7}>
            <Text style={st.forgotText}>{t('auth.forgotAppPin')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );

  if (mode === 'standalone') {
    return (
      <View style={st.root}>
        <StatusBar style={statusBarStyle} translucent />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
        {content}
      </View>
    );
  }

  return (
    <View style={st.root}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 48 : 80}
        tint={scheme === 'light' ? 'light' : 'dark'}
        style={StyleSheet.absoluteFill}
      />
      <View style={st.scrim} />
      {content}
    </View>
  );
}

function makeStyles(c: ThemeColors, scheme: 'light' | 'dark', mode: 'overlay' | 'standalone') {
  const scrim =
    scheme === 'light' ? 'rgba(255, 255, 255, 0.55)' : 'rgba(11, 11, 15, 0.62)';

  return StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 1000,
      elevation: 1000,
    },
    scrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: mode === 'overlay' ? scrim : 'transparent',
    },
    safeArea: {
      flex: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 40,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    backBtnPlaceholder: {
      height: 36,
      marginBottom: 12,
    },
    branding: {
      alignItems: 'center',
      marginBottom: 32,
    },
    logo: {
      width: 72,
      height: 46,
      marginBottom: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: c.text,
      letterSpacing: -0.3,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 14,
      color: c.textMuted,
      marginTop: 8,
      textAlign: 'center',
      lineHeight: 20,
    },
    error: {
      fontSize: 13,
      color: c.danger,
      textAlign: 'center',
      marginTop: 16,
      lineHeight: 18,
    },
    spacer: {
      flex: 1,
    },
    primaryBtn: {
      paddingVertical: 16,
      borderRadius: 14,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
    },
    primaryBtnDisabled: {
      opacity: 0.5,
    },
    primaryBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    cancelBtn: {
      alignItems: 'center',
      paddingVertical: 20,
      marginTop: 8,
    },
    cancelText: {
      fontSize: 14,
      color: c.textMuted,
      fontWeight: '600',
    },
    forgotBtn: {
      alignItems: 'center',
      paddingVertical: 12,
    },
    forgotText: {
      fontSize: 14,
      color: c.primary,
      fontWeight: '600',
    },
  });
}
