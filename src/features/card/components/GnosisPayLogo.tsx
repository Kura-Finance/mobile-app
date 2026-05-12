/**
 * Gnosis / Gnosis Pay logo via logo.dev (domain lookup).
 * Falls back to a card glyph when no token is configured or all domains fail.
 */
import React, { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { domainLogoUrl, GNOSIS_LOGO_DOMAINS, logoDevImageSource } from '../../../config/logodev';
import { useTheme } from '../../../shared/theme/ThemeContext';

interface Props {
  size: number;
}

export default function GnosisPayLogo({ size }: Props) {
  const { colors } = useTheme();
  const [domainIndex, setDomainIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setDomainIndex(0);
    setFailed(false);
  }, [size]);

  const domain = GNOSIS_LOGO_DOMAINS[domainIndex];
  const url = domain ? domainLogoUrl(domain, Math.round(size * 2)) : null;
  const source = logoDevImageSource(url);
  const radius = Math.round(size * 0.22);

  if (source && !failed) {
    return (
      <Image
        source={source}
        style={{ width: size, height: size, borderRadius: radius }}
        resizeMode="contain"
        onError={() => {
          if (domainIndex < GNOSIS_LOGO_DOMAINS.length - 1) {
            setDomainIndex((i) => i + 1);
          } else {
            setFailed(true);
          }
        }}
      />
    );
  }

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.primary, fontWeight: '800', fontSize: Math.round(size * 0.42) }}>
        G
      </Text>
    </View>
  );
}
