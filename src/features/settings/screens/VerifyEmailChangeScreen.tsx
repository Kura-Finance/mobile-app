import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIdentityToken, useLinkEmail, usePrivy, usePrivyClient, useUpdateEmail } from '@privy-io/expo';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { syncBackendSessionAfterPrivyChange } from '../../../lib/auth/syncBackendSession';
import Logger from '../../../shared/utils/Logger';

interface Props {
  newEmail: string;
  mode: 'link' | 'update';
  onClose: () => void;
}

export default function VerifyEmailChangeScreen({ newEmail, mode, onClose }: Props) {
  const { t } = useAppTranslation();
  const { updateEmail } = useUpdateEmail();
  const { linkWithCode } = useLinkEmail();
  const { getAccessToken } = usePrivy();
  const { getIdentityToken } = useIdentityToken();
  const privyClient = usePrivyClient();
  const { colors } = useTheme();

  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isLinkMode = mode === 'link';

  const handleVerify = async () => {
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      Alert.alert('Error', t('settings.verificationCodeEmpty'));
      return;
    }

    try {
      setIsLoading(true);

      if (isLinkMode) {
        Logger.info('VerifyEmailChangeScreen', 'Calling Privy linkWithCode', { newEmail });
        await linkWithCode({ code: trimmedCode, email: newEmail });
        Logger.info('VerifyEmailChangeScreen', 'Email linked in Privy');
      } else {
        Logger.info('VerifyEmailChangeScreen', 'Calling Privy updateEmail', { newEmail });
        await updateEmail({ newEmailAddress: newEmail, code: trimmedCode });
        Logger.info('VerifyEmailChangeScreen', 'Email updated in Privy');
      }

      await syncBackendSessionAfterPrivyChange({
        getAccessToken,
        getIdentityToken,
        privyClient,
      });

      Alert.alert(
        'Success',
        isLinkMode
          ? t('settings.emailLinkedSuccess', { email: newEmail })
          : t('settings.emailUpdatedSuccess', { email: newEmail }),
        [{ text: 'OK', onPress: onClose }],
      );
    } catch (err) {
      Logger.error('VerifyEmailChangeScreen', 'email verify/link failed', err);
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : t('settings.failedVerifyEmailChange'),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1, paddingTop: 64, paddingHorizontal: 24 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>
            {t('settings.verifyEmail')}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={{ width: 32, height: 32, backgroundColor: colors.surface, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: 24, lineHeight: 20 }}>
          {t('settings.verificationCodeSentTo')}{'\n'}
          <Text style={{ fontWeight: 'bold', color: colors.text }}>{newEmail}</Text>
        </Text>

        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 12 }}>
          {t('settings.verificationCode')}
        </Text>

        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder={t('settings.enterVerificationCode')}
          placeholderTextColor={colors.textFaint}
          keyboardType="number-pad"
          maxLength={10}
          editable={!isLoading}
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.primarySoft,
            borderRadius: 12,
            color: colors.text,
            padding: 16,
            fontSize: 20,
            letterSpacing: 6,
            marginBottom: 32,
          }}
        />

        <TouchableOpacity
          onPress={handleVerify}
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
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>
                {t('settings.verifying')}
              </Text>
            </>
          ) : (
            <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>
              {isLinkMode ? t('settings.verifyAndLinkEmail') : t('settings.verifyAndUpdateEmail')}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
