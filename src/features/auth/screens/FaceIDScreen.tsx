import LoadingDots from '../../../shared/components/LoadingDots';
import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';
import { useBiometricUnlockLabel } from '../../../shared/hooks/useDeviceAuthUnlockLabel';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

const CARD_LOGO = require('../../../../assets/card.webp');

interface Props {
  mode?: 'overlay' | 'standalone';
  error?: string;
  unlocking?: boolean;
  biometricsAvailable?: boolean;
  /** Large Kura welcome layout (session unlock). */
  brandLayout?: boolean;
  brandTitle?: string;
  titleKey?: string;
  subtitleKey?: string;
  enterPinLabelKey?: string;
  /** Pre-resolved label; skips an extra biometric probe when provided. */
  unlockLabel?: string | null;
  onUnlock?: () => void;
  onEnterPin?: () => void;
  onCancel?: () => void;
  onLogOut?: () => void;
}

export default function FaceIDScreen({
  mode = 'overlay',
  error,
  unlocking = false,
  biometricsAvailable = true,
  brandLayout = false,
  brandTitle = 'Kura',
  titleKey = 'auth.verifyIdentityTitle',
  subtitleKey = brandLayout ? 'auth.welcomeBack' : 'auth.confirmBiometricSubtitle',
  enterPinLabelKey = 'auth.enterAppPin',
  unlockLabel,
  onUnlock,
  onEnterPin,
  onCancel,
  onLogOut,
}: Props) {
  const { colors, scheme } = useTheme();
  const { t } = useAppTranslation();
  const resolvedUnlockLabel = useBiometricUnlockLabel();
  const unlockButtonLabel = unlockLabel ?? resolvedUnlockLabel;
  const st = useMemo(() => makeStyles(colors, scheme, mode, brandLayout), [colors, scheme, mode, brandLayout]);
  const statusBarStyle = scheme === 'light' ? 'dark' : 'light';
  const showBiometricButton = biometricsAvailable && !!onUnlock;
  const showEnterPinButton = !!onEnterPin;
  const primaryIsPin = !showBiometricButton && showEnterPinButton;

  const content = (
    <SafeAreaView style={st.safeArea} edges={['top', 'bottom']}>
      <View style={st.content}>
        <View style={st.branding}>
          {brandLayout ? (
            <Image source={CARD_LOGO} style={st.logo} resizeMode="contain" />
          ) : null}
          <Text style={st.title}>{brandLayout ? brandTitle : t(titleKey)}</Text>
          <Text style={st.subtitle}>{t(subtitleKey)}</Text>
        </View>

        <View style={st.spacer} />

        <View style={st.actions}>
          {showBiometricButton ? (
            <TouchableOpacity
              onPress={onUnlock}
              disabled={unlocking}
              style={[st.unlockBtn, unlocking && st.unlockBtnDisabled]}
              activeOpacity={0.85}
            >
              {unlocking ? (
                <LoadingDots compact color="#FFFFFF" size={6} />
              ) : (
                <Text style={st.unlockBtnText}>{unlockButtonLabel ?? t('auth.useBiometric')}</Text>
              )}
            </TouchableOpacity>
          ) : null}

          {primaryIsPin ? (
            <TouchableOpacity
              onPress={onEnterPin}
              disabled={unlocking}
              style={[st.unlockBtn, unlocking && st.unlockBtnDisabled]}
              activeOpacity={0.85}
            >
              <Text style={[st.unlockBtnText, unlocking && st.disabledText]}>
                {t(enterPinLabelKey)}
              </Text>
            </TouchableOpacity>
          ) : null}

          {showEnterPinButton && showBiometricButton ? (
            <TouchableOpacity
              onPress={onEnterPin}
              disabled={unlocking}
              style={[st.secondaryBtn, unlocking && st.secondaryBtnDisabled]}
              activeOpacity={0.7}
            >
              <Text style={[st.secondaryBtnText, unlocking && st.disabledText]}>
                {t(enterPinLabelKey)}
              </Text>
            </TouchableOpacity>
          ) : null}

          {error ? <Text style={st.error}>{error}</Text> : null}

          {onCancel ? (
            <TouchableOpacity
              onPress={onCancel}
              disabled={unlocking}
              style={[st.cancelBtn, unlocking && st.cancelBtnDisabled]}
              activeOpacity={0.7}
            >
              <Text style={[st.cancelText, unlocking && st.disabledText]}>
                {t('common.cancel')}
              </Text>
            </TouchableOpacity>
          ) : null}

          {onLogOut ? (
            <TouchableOpacity
              onPress={onLogOut}
              disabled={unlocking}
              style={[st.logOutBtn, unlocking && st.logOutBtnDisabled]}
              activeOpacity={0.7}
            >
              <Text style={[st.logOutText, unlocking && st.disabledText]}>
                {t('auth.logOut')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );

  if (mode === 'standalone') {
    return (
      <View style={st.root}>
        <StatusBar style={statusBarStyle} translucent />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
        {content}
        {unlocking ? <View style={st.interactionBlocker} pointerEvents="box-only" /> : null}
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
      {unlocking ? <View style={st.interactionBlocker} pointerEvents="box-only" /> : null}
    </View>
  );
}

function makeStyles(
  c: ThemeColors,
  scheme: 'light' | 'dark',
  mode: 'overlay' | 'standalone',
  brandLayout: boolean,
) {
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
    safeArea: { flex: 1 },
    content: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: brandLayout ? 120 : 72,
      paddingBottom: 40,
    },
    branding: {
      alignItems: 'center',
      marginTop: brandLayout ? 24 : 0,
      marginBottom: brandLayout ? 48 : 32,
    },
    logo: {
      width: brandLayout ? 88 : 72,
      height: brandLayout ? 56 : 46,
      marginBottom: brandLayout ? 20 : 16,
    },
    title: {
      fontSize: brandLayout ? 30 : 24,
      fontWeight: '700',
      color: c.text,
      letterSpacing: brandLayout ? -0.5 : -0.3,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 14,
      color: c.textMuted,
      marginTop: brandLayout ? 6 : 8,
      textAlign: 'center',
      lineHeight: 20,
    },
    spacer: { flex: 1 },
    actions: { gap: 0 },
    unlockBtn: {
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
    unlockBtnDisabled: { opacity: 0.7 },
    unlockBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
    secondaryBtn: { alignItems: 'center', paddingVertical: 18, marginTop: 4 },
    secondaryBtnDisabled: { opacity: 0.45 },
    secondaryBtnText: { fontSize: 15, color: c.primary, fontWeight: '600' },
    disabledText: { opacity: 0.45 },
    error: {
      fontSize: 13,
      color: c.danger,
      textAlign: 'center',
      marginTop: 14,
      lineHeight: 18,
    },
    cancelBtn: { alignItems: 'center', paddingVertical: 20, marginTop: 8 },
    cancelBtnDisabled: { opacity: 0.45 },
    cancelText: { fontSize: 14, color: c.textMuted, fontWeight: '600' },
    logOutBtn: { alignItems: 'center', paddingVertical: 20, marginTop: 8 },
    logOutBtnDisabled: { opacity: 0.45 },
    logOutText: { fontSize: 14, color: c.textMuted, fontWeight: '600' },
    interactionBlocker: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 20,
    },
  });
}
