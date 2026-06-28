import LoadingDots from '../../../shared/components/LoadingDots';
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLinkEmail, useUpdateEmail } from '@privy-io/expo';
import { useAppStore } from '../../../shared/store/useAppStore';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';
import Logger from '../../../shared/utils/Logger';
import VerifyEmailChangeScreen from './VerifyEmailChangeScreen';

interface Props {
  onClose: () => void;
}

export default function EditEmailScreen({ onClose }: Props) {
  const { t } = useAppTranslation();
  const { colors } = useTheme();
  const userProfile = useAppStore((s) => s.userProfile);
  const { sendCode: sendUpdateCode } = useUpdateEmail();
  const { sendCode: sendLinkCode } = useLinkEmail();

  const isLinkMode = userProfile.emailIsPlaceholder;
  const [email, setEmailState] = useState(isLinkMode ? '' : userProfile.email);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const handleSendCode = async () => {
    const trimmed = email.trim().toLowerCase();

    if (!trimmed) {
      Alert.alert('Error', t('settings.emailEmpty'));
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      Alert.alert('Error', t('settings.invalidEmailFormat'));
      return;
    }
    if (!isLinkMode && trimmed === userProfile.email.trim().toLowerCase()) {
      Alert.alert('Info', 'Email is the same as the current one');
      return;
    }

    try {
      setIsLoading(true);
      if (isLinkMode) {
        await sendLinkCode({ email: trimmed });
        Logger.info('EditEmailScreen', 'Privy link-email OTP sent', { email: trimmed });
      } else {
        await sendUpdateCode({ newEmailAddress: trimmed });
        Logger.info('EditEmailScreen', 'Privy update-email OTP sent', { newEmail: trimmed });
      }
      setPendingEmail(trimmed);
    } catch (err) {
      Logger.error('EditEmailScreen', 'sendCode failed', err);
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : t('settings.failedRequestEmailChange'),
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (pendingEmail) {
    return (
      <VerifyEmailChangeScreen
        newEmail={pendingEmail}
        mode={isLinkMode ? 'link' : 'update'}
        onClose={onClose}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1, paddingTop: 64, paddingHorizontal: 24 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>
            {isLinkMode ? t('settings.linkEmail') : t('settings.editEmail')}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={{ width: 32, height: 32, backgroundColor: colors.surface, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {isLinkMode ? (
          <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: 24, lineHeight: 20 }}>
            {t('settings.linkEmailHint')}
          </Text>
        ) : null}

        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 16 }}>
          {t('settings.emailAddress')}
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmailState}
          placeholder={t('settings.enterNewEmail')}
          placeholderTextColor={colors.textFaint}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.primarySoft,
            borderRadius: 12,
            color: colors.text,
            padding: 16,
            fontSize: 16,
            marginBottom: 32,
          }}
        />

        <TouchableOpacity
          onPress={handleSendCode}
          disabled={isLoading}
          style={{
            width: '100%',
            paddingVertical: 16,
            borderRadius: 12,
            backgroundColor: isLoading ? colors.textFaint : colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
          }}
        >
          {isLoading ? (
            <>
              <LoadingDots compact color="#FFFFFF" size={6}    />
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>
                {t('settings.sending')}
              </Text>
            </>
          ) : (
            <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>
              {t('settings.sendVerification')}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
