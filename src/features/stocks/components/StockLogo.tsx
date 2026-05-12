/**
 * StockLogo
 *
 * Renders a ticker logo from logo.dev. Falls back to a coloured glyph circle
 * when no logo.dev token is configured or the image fails to load.
 */
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { stockColor, stockGlyph, stockLogoUrl } from '../config/dinariStocks';
import { logoDevImageSource } from '../../../config/logodev';

interface Props {
  symbol: string;
  size: number;
}

export default function StockLogo({ symbol, size }: Props) {
  const [failed, setFailed] = useState(false);
  const color = stockColor(symbol);
  const url = stockLogoUrl(symbol, Math.round(size * 2)); // 2x for retina
  const source = logoDevImageSource(url);

  // Reset the error state if the symbol changes (recycled rows).
  useEffect(() => { setFailed(false); }, [symbol]);

  const radius = size / 2;

  if (source && !failed) {
    return (
      <Image
        source={source}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: '#FFFFFF' }}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: radius, backgroundColor: `${color}22` },
      ]}
    >
      <Text style={{ color, fontWeight: '800', fontSize: Math.round(size * 0.34) }}>
        {stockGlyph(symbol)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
