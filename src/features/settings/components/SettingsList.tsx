import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';

interface SettingsListProps {
  onProfileSecurityPress?: () => void;
  onConnectedAccountsPress?: () => void;
}

export default function SettingsList({ onProfileSecurityPress, onConnectedAccountsPress }: SettingsListProps) {
  const { t } = useAppTranslation();
  const { colors } = useTheme();

  const rowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  };

  return (
    <View style={{ flexDirection: 'column', gap: 8 }}>
      <TouchableOpacity onPress={onProfileSecurityPress} style={rowStyle}>
        <Text style={{ color: colors.text, fontWeight: '500' }}>{t('settings.profileSecurity')}</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onConnectedAccountsPress} style={rowStyle}>
        <Text style={{ color: colors.text, fontWeight: '500' }}>{t('settings.connectedAccounts')}</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}
