import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useLoginWithEmail, useLoginWithOAuth } from '@privy-io/expo';
import { brand } from '../../../config/branding';
import {
  formatAppleFullName,
  setPendingAppleDisplayName,
} from '../../../lib/auth/oauthDisplayName';
import { useTheme } from '../../../shared/theme/ThemeContext';

const TOS_URL = `${brand.homepage}/tos`;
const PRIVACY_URL = `${brand.homepage}/privacy`;

const CARD_LOGO = require('../../../../assets/card.webp');

function openLegalUrl(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

type LoginStep = 'home' | 'email-entry' | 'otp';

/** Privy throws a typed error with a `code` field when the user cancels OAuth. */
function isCancelledError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code ?? '';
  return (
    code.includes('cancelled') ||
    code.includes('canceled') ||
    code.includes('cancel') ||
    code === 'login_with_oauth_was_cancelled_by_user' ||
    code === 'link_with_oauth_was_cancelled_by_user'
  );
}

export default function PrivyLoginScreen() {
  const { colors, scheme } = useTheme();
  const [step, setStep] = useState<LoginStep>('home');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { sendCode, loginWithCode, state: emailState } = useLoginWithEmail();
  const { login: loginWithOAuth } = useLoginWithOAuth();

  const isLoading =
    emailState.status === 'sending-code' ||
    emailState.status === 'awaiting-code-input' && false ||
    emailState.status === 'submitting-code';

  // ── Email OTP flow ──────────────────────────────────────────────────────

  const handleSendCode = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(null);
    try {
      await sendCode({ email: email.trim().toLowerCase() });
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code. Please try again.');
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 6) {
      setError('Please enter the 6-digit code.');
      return;
    }
    setError(null);
    try {
      await loginWithCode({ code: otp });
      // PrivyBridgeProvider in App.tsx will pick up the authenticated state
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code. Please try again.');
    }
  };

  // ── Social login ────────────────────────────────────────────────────────

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      await loginWithOAuth({ provider: 'google' });
    } catch (err) {
      if (isCancelledError(err)) return;
      setError(err instanceof Error ? err.message : 'Google login failed. Please try again.');
    }
  };

  const handleAppleLogin = async () => {
    setError(null);
    try {
      await loginWithOAuth({
        provider: 'apple',
        onAppleOAuthUserInfo: ({ fullName }) => {
          const displayName = formatAppleFullName(fullName);
          if (displayName) {
            setPendingAppleDisplayName(displayName);
          }
        },
      });
    } catch (err) {
      if (isCancelledError(err)) return;
      setError(err instanceof Error ? err.message : 'Apple login failed. Please try again.');
    }
  };

  // ── Render helpers ──────────────────────────────────────────────────────

  const renderError = () =>
    error ? (
      <View
        style={{
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 10,
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 1,
          borderColor: 'rgba(239, 68, 68, 0.3)',
          marginBottom: 20,
        }}
      >
        <Text style={{ fontSize: 13, color: colors.danger, textAlign: 'center' }}>{error}</Text>
      </View>
    ) : null;

  // ── Main screen (home) ──────────────────────────────────────────────────

  const renderHome = () => (
    <View style={{ flex: 1 }}>
      {/* Logo / branding */}
      <View style={{ alignItems: 'center', marginBottom: 48 }}>
        <Image
          source={CARD_LOGO}
          style={{ width: 88, height: 56, marginBottom: 20 }}
          resizeMode="contain"
        />
        <Text style={{ fontSize: 30, fontWeight: '700', color: colors.text, letterSpacing: -0.5 }}>
          Kura
        </Text>
        <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 6 }}>
          Your intelligent neobank
        </Text>
      </View>

      {renderError()}

      {/* Social logins */}
      <View style={{ gap: 12 }}>
        {Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={
              scheme === 'light'
                ? AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                : AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            }
            cornerRadius={14}
            style={{ width: '100%', height: 50 }}
            onPress={() => {
              void handleAppleLogin();
            }}
          />
        )}
        <SocialButton
          icon="logo-google"
          label="Continue with Google"
          onPress={handleGoogleLogin}
        />
      </View>

      {/* Divider */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 24 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text style={{ color: colors.textFaint, fontSize: 12, marginHorizontal: 12 }}>or</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>

      {/* Email button */}
      <TouchableOpacity
        onPress={() => setStep('email-entry')}
        style={{
          paddingVertical: 15,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        }}
      >
        <Ionicons name="mail-outline" size={20} color={colors.text} />
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
          Continue with Email
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ── Email entry step ────────────────────────────────────────────────────

  const renderEmailEntry = () => (
    <View style={{ flex: 1 }}>
      <TouchableOpacity
        onPress={() => { setStep('home'); setError(null); }}
        style={{ marginBottom: 24 }}
      >
        <Ionicons name="arrow-back" size={24} color={colors.textMuted} />
      </TouchableOpacity>

      <Text style={{ fontSize: 26, fontWeight: '700', color: colors.text, marginBottom: 8 }}>
        Enter your email
      </Text>
      <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 32 }}>
        We'll send you a one-time code to sign in.
      </Text>

      {renderError()}

      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={{ marginRight: 10 }} />
        <TextInput
          placeholder="your@email.com"
          placeholderTextColor={colors.textFaint}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          autoCapitalize="none"
          autoFocus
          editable={!isLoading}
          style={{ flex: 1, color: colors.text, fontSize: 15 }}
        />
      </View>

      <PrimaryButton
        label="Send Code"
        onPress={handleSendCode}
        loading={emailState.status === 'sending-code'}
      />
    </View>
  );

  // ── OTP step ────────────────────────────────────────────────────────────

  const renderOtp = () => (
    <View style={{ flex: 1 }}>
      <TouchableOpacity
        onPress={() => { setStep('email-entry'); setError(null); setOtp(''); }}
        style={{ marginBottom: 24 }}
      >
        <Ionicons name="arrow-back" size={24} color={colors.textMuted} />
      </TouchableOpacity>

      <Text style={{ fontSize: 26, fontWeight: '700', color: colors.text, marginBottom: 8 }}>
        Check your email
      </Text>
      <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 32 }}>
        We sent a 6-digit code to{' '}
        <Text style={{ color: colors.primary, fontWeight: '600' }}>{email}</Text>
      </Text>

      {renderError()}

      <View
        style={{
          borderWidth: 1,
          borderColor: colors.primarySoft,
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <Ionicons name="key-outline" size={18} color={colors.primary} style={{ marginRight: 10 }} />
        <TextInput
          placeholder="000000"
          placeholderTextColor={colors.textFaint}
          value={otp}
          onChangeText={setOtp}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          editable={emailState.status !== 'submitting-code'}
          style={{
            flex: 1,
            color: colors.text,
            fontSize: 22,
            fontWeight: '700',
            letterSpacing: 6,
          }}
        />
      </View>

      <PrimaryButton
        label="Sign In"
        onPress={handleVerifyOtp}
        loading={emailState.status === 'submitting-code'}
      />

      <TouchableOpacity
        onPress={() => {
          setError(null);
          handleSendCode();
        }}
        style={{ marginTop: 16, alignItems: 'center' }}
      >
        <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '500' }}>
          Resend code
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ── Layout ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 48, paddingBottom: 40 }}>
            {step === 'home' && renderHome()}
            {step === 'email-entry' && renderEmailEntry()}
            {step === 'otp' && renderOtp()}

            {/* Legal */}
            <Text
              style={{
                fontSize: 11,
                color: colors.textFaint,
                textAlign: 'center',
                lineHeight: 16,
                marginTop: 32,
              }}
            >
              By continuing, you agree to our{' '}
              <Text
                style={{ color: colors.primary }}
                onPress={() => openLegalUrl(TOS_URL)}
              >
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text
                style={{ color: colors.primary }}
                onPress={() => openLegalUrl(PRIVACY_URL)}
              >
                Privacy Policy
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SocialButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingVertical: 15,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
      }}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{label}</Text>
    </TouchableOpacity>
  );
}

function PrimaryButton({
  label,
  onPress,
  loading,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      style={{
        paddingVertical: 16,
        borderRadius: 14,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: loading ? 0.7 : 1,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      }}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}
