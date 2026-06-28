import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { CARD_WIDTH, CARD_HEIGHT } from './VirtualCard';

const METAL_COLORS: [string, string, ...string[]] = [
  '#FAFAFC',
  '#ECECF2',
  '#D8D8E2',
  '#F2F2F6',
];

export default function MetalCard({ showCornerLabel = true }: { showCornerLabel?: boolean }) {
  const { t } = useTranslation();

  return (
    <LinearGradient
      colors={METAL_COLORS}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { width: CARD_WIDTH, height: CARD_HEIGHT }]}
    >
      <View style={styles.sheenStripe} pointerEvents="none" />
      <LinearGradient
        colors={['rgba(255,255,255,0.72)', 'rgba(255,255,255,0)', 'rgba(148,163,184,0.08)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1.2 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.topRow}>
        <View style={styles.logoWrap}>
          <Image
            source={require('../../../../assets/card.webp')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
        </View>
        {showCornerLabel ? (
          <Text style={styles.cornerLabel}>{t('card.metalLabel')}</Text>
        ) : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  sheenStripe: {
    position: 'absolute',
    top: -20,
    left: CARD_WIDTH * 0.18,
    width: CARD_WIDTH * 0.22,
    height: CARD_HEIGHT * 1.4,
    backgroundColor: 'rgba(255,255,255,0.35)',
    transform: [{ rotate: '-18deg' }],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  logoWrap: {
    width: CARD_WIDTH * 0.11,
    height: CARD_HEIGHT * 0.22,
    justifyContent: 'center',
  },
  brandLogo: {
    width: CARD_WIDTH * 0.11,
    height: CARD_HEIGHT * 0.22,
  },
  cornerLabel: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 2,
  },
});
