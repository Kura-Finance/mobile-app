import React from 'react';
import { Text } from 'react-native';
import { useTheme } from '../../../shared/theme/ThemeContext';

interface SectionHeaderProps {
  title: string;
}

export default function SectionHeader({ title }: SectionHeaderProps) {
  const { colors } = useTheme();
  return (
    <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 16 }}>{title}</Text>
  );
}
