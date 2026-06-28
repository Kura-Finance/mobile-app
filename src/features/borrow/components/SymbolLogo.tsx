import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import TokenLogo from '../../crypto/components/TokenLogo';
import { cryptoLogoUrl, logoDevImageSource } from '../../../config/logodev';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import {
  logoSymbolForAsset,
  resolveBluechipToken,
  symbolFallbackGlyph,
} from '../utils/symbolLogo';

interface Props {
  symbol: string;
  size: number;
}

export default function SymbolLogo({ symbol, size }: Props) {
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors, size), [colors, size]);
  const token = useMemo(() => resolveBluechipToken(symbol), [symbol]);
  const [failed, setFailed] = useState(false);

  const remoteUrl = useMemo(() => {
    if (token) return null;
    return cryptoLogoUrl(logoSymbolForAsset(symbol), Math.round(size * 2));
  }, [symbol, size, token]);

  const source = logoDevImageSource(remoteUrl);

  useEffect(() => {
    setFailed(false);
  }, [symbol, remoteUrl]);

  if (token) {
    return <TokenLogo token={token} size={size} />;
  }

  if (source && !failed) {
    return (
      <Image
        source={source}
        style={st.image}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View style={st.fallback}>
      <Text style={st.glyph} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
        {symbolFallbackGlyph(symbol)}
      </Text>
    </View>
  );
}

function makeStyles(c: ThemeColors, size: number) {
  return StyleSheet.create({
    image: {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: '#FFFFFF',
    },
    fallback: {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: c.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    glyph: {
      color: c.text,
      fontSize: Math.max(8, size * 0.34),
      fontWeight: '800',
      textAlign: 'center',
    },
  });
}
