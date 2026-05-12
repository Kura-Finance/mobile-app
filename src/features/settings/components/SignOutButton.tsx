import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { useTheme } from '../../../shared/theme/ThemeContext';

interface SignOutButtonProps {
  onPress: () => void;
}

export default function SignOutButton({ onPress }: SignOutButtonProps) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ marginTop: 24, width: '100%', paddingVertical: 16, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.1)', alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: colors.danger, fontWeight: 'bold' }}>Sign Out</Text>
    </TouchableOpacity>
  );
}
