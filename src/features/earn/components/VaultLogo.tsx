import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SvgUri } from 'react-native-svg';

import { useTheme } from '../../../shared/theme/ThemeContext';
import { logoDevImageSource } from '../../../config/logodev';
import type { MorphoVault } from '../../../lib/api/morpho/client';
import {
  isRasterLogoUrl,
  isSvgLogoUrl,
  resolveVaultLogoCandidates,
  vaultFallbackGlyph,
} from '../config/vaultCuratorLogos';

interface Props {
  vault: Pick<MorphoVault, 'name' | 'imageUrl' | 'asset'>;
  size?: number;
}

export default function VaultLogo({ vault, size = 44 }: Props) {
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors, size), [colors, size]);
  const candidates = useMemo(
    () =>
      resolveVaultLogoCandidates(
        vault.name,
        vault.imageUrl,
        vault.asset.symbol,
        Math.round(size * 2),
      ),
    [vault.name, vault.imageUrl, vault.asset.symbol, size],
  );
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [vault.name, vault.imageUrl, vault.asset.symbol]);

  const uri = candidates[candidateIndex] ?? null;

  const fail = () => {
    setCandidateIndex((i) => (i + 1 < candidates.length ? i + 1 : candidates.length));
  };

  if (uri && candidateIndex < candidates.length) {
    if (isSvgLogoUrl(uri)) {
      return (
        <View style={[st.image, st.imageCenter]}>
          <SvgUri
            uri={uri}
            width={size * 0.72}
            height={size * 0.72}
            onError={fail}
          />
        </View>
      );
    }

    if (isRasterLogoUrl(uri) || uri.startsWith('http')) {
      const source = logoDevImageSource(uri) ?? { uri };
      return (
        <Image
          source={source}
          style={st.image}
          resizeMode="contain"
          onError={fail}
        />
      );
    }
  }

  const letter = vaultFallbackGlyph(vault.name, vault.asset.symbol);
  return (
    <View style={st.fallback}>
      <Text style={st.letter}>{letter}</Text>
    </View>
  );
}

function makeStyles(c: { surfaceAlt: string; text: string; border: string }, size: number) {
  return StyleSheet.create({
    image: {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: '#FFFFFF',
    },
    imageCenter: {
      alignItems: 'center',
      justifyContent: 'center',
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
    },
    letter: {
      color: c.text,
      fontSize: size * 0.38,
      fontWeight: '700',
    },
  });
}
