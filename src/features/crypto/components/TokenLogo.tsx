/**
 * TokenLogo
 *
 * Renders a crypto token logo from logo.dev. Falls back to the token's emoji
 * glyph circle when no logo.dev token is configured or the image fails to load.
 */
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { cryptoLogoUrl, BluechipToken } from '../config/blueChips';
import { logoDevImageSource } from '../../../config/logodev';

interface Props {
  token: BluechipToken;
  size: number;
}

export default function TokenLogo({ token, size }: Props) {
  const [failed, setFailed] = useState(false);
  const url = cryptoLogoUrl(token, Math.round(size * 2)); // 2x for retina
  const source = logoDevImageSource(url);
  const radius = size / 2;

  useEffect(() => { setFailed(false); }, [token.symbol]);

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
        { width: size, height: size, borderRadius: radius, backgroundColor: `${token.color}22` },
      ]}
    >
      <Text style={{ color: token.color, fontWeight: '700', fontSize: Math.round(size * 0.4) }}>
        {token.emoji}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
