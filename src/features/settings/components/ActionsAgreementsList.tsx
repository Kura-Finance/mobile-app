import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';
import SignOutButton from './SignOutButton';

interface Props {
  onReferralsPress?: () => void;
  onAgreementsPress?: () => void;
  onSignOutPress?: () => void;
  showSignOut?: boolean;
}

export default function ActionsAgreementsList({
  onReferralsPress,
  onAgreementsPress,
  onSignOutPress,
  showSignOut,
}: Props) {
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
    <View style={{ flexDirection: 'column', gap: 8, marginTop: 4 }}>
      <TouchableOpacity onPress={onReferralsPress} style={rowStyle} activeOpacity={0.7}>
        <Text style={{ color: colors.text, fontWeight: '500' }}>{t('settings.referrals')}</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onAgreementsPress} style={rowStyle} activeOpacity={0.7}>
        <Text style={{ color: colors.text, fontWeight: '500' }}>{t('settings.ourAgreements')}</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </TouchableOpacity>
      {showSignOut && onSignOutPress ? (
        <SignOutButton onPress={onSignOutPress} />
      ) : null}
    </View>
  );
}
