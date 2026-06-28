import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import SymbolLogo from './SymbolLogo';

interface Props {
  collateral: string;
  loan: string;
  size?: number;
}

export default function MarketPairLogo({ collateral, loan, size = 44 }: Props) {
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors, size), [colors, size]);
  const topSize = Math.round(size * 0.68);
  const bottomSize = Math.round(size * 0.59);

  return (
    <View style={[st.wrap, { width: size, height: size }]}>
      <View style={[st.top, { width: topSize, height: topSize, borderRadius: topSize / 2 }]}>
        <SymbolLogo symbol={collateral} size={topSize} />
      </View>
      <View style={[st.bottom, { width: bottomSize, height: bottomSize, borderRadius: bottomSize / 2 }]}>
        <SymbolLogo symbol={loan} size={bottomSize} />
      </View>
    </View>
  );
}

function makeStyles(c: ThemeColors, size: number) {
  return StyleSheet.create({
    wrap: {
      position: 'relative',
    },
    top: {
      position: 'absolute',
      top: 0,
      left: 0,
      backgroundColor: c.background,
      borderWidth: 1.5,
      borderColor: c.background,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      zIndex: 2,
    },
    bottom: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: c.background,
      borderWidth: 1.5,
      borderColor: c.background,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      zIndex: 1,
    },
  });
}
