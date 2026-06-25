import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';

interface SignOutButtonProps {
  onPress: () => void;
}

export default function SignOutButton({ onPress }: SignOutButtonProps) {
  const { t } = useAppTranslation();
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        marginTop: 4,
        width: '100%',
        paddingVertical: 16,
        borderRadius: 12,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      activeOpacity={0.75}
    >
      <Text style={{ color: colors.danger, fontWeight: 'bold' }}>{t('settings.logOut')}</Text>
    </TouchableOpacity>
  );
}
