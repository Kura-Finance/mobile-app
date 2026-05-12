/**
 * ChainLogo — network icon via logo.dev (domain + crypto fallback).
 * Falls back to a tinted initial when logo.dev is unavailable.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { chainLogoUrls, logoDevImageSource } from '../../../config/logodev';

export interface ChainLogoChain {
  key: string;
  name: string;
  color: string;
}

interface Props {
  chain: ChainLogoChain;
  size: number;
}

export default function ChainLogo({ chain, size }: Props) {
  const [urlIndex, setUrlIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const urls = useMemo(
    () => chainLogoUrls(chain.key, Math.round(size * 2)),
    [chain.key, size],
  );
  const radius = size / 2;

  useEffect(() => {
    setUrlIndex(0);
    setFailed(false);
  }, [chain.key, size]);

  const url = !failed && urls[urlIndex] ? urls[urlIndex] : null;
  const source = logoDevImageSource(url);

  if (source) {
    return (
      <Image
        source={source}
        style={{ width: size, height: size, borderRadius: radius }}
        resizeMode="contain"
        onError={() => {
          if (urlIndex < urls.length - 1) {
            setUrlIndex((i) => i + 1);
          } else {
            setFailed(true);
          }
        }}
      />
    );
  }

  const initial = chain.name.charAt(0).toUpperCase();

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: `${chain.color}22`,
        },
      ]}
    >
      <Text style={{ color: chain.color, fontWeight: '700', fontSize: Math.round(size * 0.38) }}>
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
