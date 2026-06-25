import React, { useMemo } from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../shared/theme/ThemeContext';
import StandardCard from './StandardCard';
import MetalCard from './MetalCard';
import { CARD_HEIGHT } from './VirtualCard';

interface CardApplyBannerProps {
  onPress: () => void;
}

export function CardApplyBanner({ onPress }: CardApplyBannerProps) {
  const { scheme } = useTheme();
  const s = useMemo(() => makeStyles(), []);
  const isDark = scheme === 'dark';
  const chevronColor = isDark ? 'rgba(237,233,254,0.85)' : '#64748B';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={s.applyWrap}>
      <View style={s.cardShell}>
        {isDark ? (
          <StandardCard masked showCornerLabel={false} />
        ) : (
          <MetalCard showCornerLabel={false} />
        )}
        <View style={s.chevronWrap} pointerEvents="none">
          <Ionicons name="chevron-forward" size={24} color={chevronColor} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function makeStyles() {
  return StyleSheet.create({
    applyWrap: {
      marginBottom: 20,
      alignItems: 'center',
    },
    cardShell: {
      height: CARD_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chevronWrap: {
      position: 'absolute',
      right: 20,
      top: '50%',
      marginTop: -12,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
