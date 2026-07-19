import LoadingDots from '../../../shared/components/LoadingDots';
import React, { useEffect, useMemo, useState } from 'react';
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
import PinInput from '../components/PinInput';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';
import { useBiometricUnlockLabel } from '../../../shared/hooks/useDeviceAuthUnlockLabel';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { APP_PIN_LENGTH } from '../../../lib/security/appPinCore';

const CARD_LOGO = require('../../../../assets/card.webp');

interface Props {
  mode?: 'overlay' | 'standalone';
  error?: string;
  submitting?: boolean;
  submitLabelKey?: string;
  subtitleKey?: string;
  showForgotPin?: boolean;
  onSubmit: (pin: string) => void | Promise<void>;
  onCancel?: () => void;
  /** Show biometric method label instead of Cancel (unlock flow). Hidden when unavailable. */
  cancelUsesBiometricLabel?: boolean;
  /** Pre-resolved label; skips an extra biometric probe when provided. */
  biometricCancelLabel?: string | null;
  onForgotPin?: () => void;
}

export default function EnterAppPinScreen({
  mode = 'overlay',
  error,
  submitting = false,
  submitLabelKey = 'auth.unlockWithAppPin',
  subtitleKey = 'auth.enterAppPinSubtitle',
  showForgotPin = false,
  onSubmit,
  onCancel,
  cancelUsesBiometricLabel = false,
  biometricCancelLabel,
  onForgotPin,
}: Props) {
  const { colors, scheme } = useTheme();
  const { t } = useAppTranslation();
  const resolvedBiometricCancelLabel = useBiometricUnlockLabel();
  const [pin, setPin] = useState('');
  const st = useMemo(() => makeStyles(colors, scheme, mode), [colors, scheme, mode]);
  const statusBarStyle = scheme === 'light' ? 'dark' : 'light';
  const canSubmit = pin.length === APP_PIN_LENGTH && !submitting;
  const cancelLabel = cancelUsesBiometricLabel
    ? (biometricCancelLabel ?? resolvedBiometricCancelLabel ?? (onCancel ? t('auth.useBiometric') : null))
    : onCancel
      ? t('common.cancel')
      : null;

  useEffect(() => {
    if (error) setPin('');
  }, [error]);

  const handleSubmit = () => {
    if (!canSubmit) return;
    Keyboard.dismiss();
    void onSubmit(pin);
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
        <View style={st.branding}>
          <Image source={CARD_LOGO} style={st.logo} resizeMode="contain" />
          <Text style={st.title}>{t('auth.enterAppPinTitle')}</Text>
          <Text style={st.subtitle}>{t(subtitleKey)}</Text>
        </View>

        <PinInput value={pin} onChange={setPin} editable={!submitting} />

        {error ? <Text style={st.error}>{error}</Text> : null}

        <View style={st.spacer} />

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={[st.primaryBtn, !canSubmit && st.primaryBtnDisabled]}
          activeOpacity={0.85}
        >
          {submitting ? (
            <LoadingDots compact color="#FFFFFF" size={6} />
          ) : (
            <Text style={st.primaryBtnText}>{t(submitLabelKey)}</Text>
          )}
        </TouchableOpacity>

        {onCancel && cancelLabel ? (
          <TouchableOpacity onPress={onCancel} style={st.cancelBtn} activeOpacity={0.7}>
            <Text
              style={cancelUsesBiometricLabel ? st.biometricCancelText : st.cancelText}
            >
              {cancelLabel}
            </Text>
          </TouchableOpacity>
        ) : null}

        {showForgotPin && onForgotPin ? (
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
      paddingTop: 48,
      paddingBottom: 40,
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
    biometricCancelText: {
      fontSize: 14,
      color: c.primary,
      fontWeight: '600',
    },
    forgotBtn: {
      alignItems: 'center',
      paddingVertical: 20,
      marginTop: 8,
    },
    forgotText: {
      fontSize: 14,
      color: c.primary,
      fontWeight: '600',
    },
  });
}
