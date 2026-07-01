import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { CARD_WIDTH, CARD_HEIGHT } from './VirtualCard';

const STANDARD_COLORS: [string, string, ...string[]] = [
  '#07050D',
  '#140A24',
  '#2E1065',
  '#4C1D95',
  '#312E81',
];

interface Props {
  masked: boolean;
  showDetails?: boolean;
  showCornerLabel?: boolean;
  last4?: string;
  expires?: string;
  cardHolder?: string;
}

function formatPan(masked: boolean, last4?: string): string {
  if (!masked) return '4242   4242   4242   4242';
  const suffix = last4 && last4 !== '••••' ? last4 : '••••';
  return `••••   ••••   ••••   ${suffix}`;
}

export default function StandardCard({
  masked,
  showDetails = false,
  showCornerLabel = true,
  last4,
  expires,
  cardHolder,
}: Props) {
  const { t } = useTranslation();
  const holder = cardHolder ?? t('card.kuraMember');
  const expiry = masked ? '••/••' : (expires ?? '12/28');
  const cvv = masked ? '•••' : '123';

  return (
    <LinearGradient
      colors={STANDARD_COLORS}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { width: CARD_WIDTH, height: CARD_HEIGHT }]}
    >
      <View style={styles.sheenStripe} pointerEvents="none" />
      <LinearGradient
        colors={['rgba(167,139,250,0.18)', 'rgba(255,255,255,0)', 'rgba(76,29,149,0.12)']}
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
          <Text style={styles.cornerLabel}>{t('card.virtualLabel')}</Text>
        ) : null}
      </View>

      {showDetails ? (
        <>
          <Text style={styles.number}>{formatPan(masked, last4)}</Text>
          <View style={styles.bottomRow}>
            <View style={styles.holderCol}>
              <Text style={styles.label}>{t('card.cardHolder')}</Text>
              <Text style={styles.valueText} numberOfLines={1}>
                {holder}
              </Text>
            </View>
            <View style={styles.metaCol}>
              <View style={styles.metaBlock}>
                <Text style={styles.label}>{t('card.expires')}</Text>
                <Text style={styles.valueText}>{expiry}</Text>
              </View>
              <View style={styles.metaBlock}>
                <Text style={styles.label}>{t('card.securityCode')}</Text>
                <Text style={styles.valueText}>{cvv}</Text>
              </View>
            </View>
          </View>
        </>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  sheenStripe: {
    position: 'absolute',
    top: -20,
    left: CARD_WIDTH * 0.12,
    width: CARD_WIDTH * 0.28,
    height: CARD_HEIGHT * 1.5,
    backgroundColor: 'rgba(167,139,250,0.1)',
    transform: [{ rotate: '-16deg' }],
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
    tintColor: 'rgba(255,255,255,0.92)',
  },
  cornerLabel: {
    color: 'rgba(237,233,254,0.92)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  number: {
    color: '#F5F3FF',
    fontSize: 15,
    letterSpacing: 2.4,
    fontFamily: 'monospace',
    marginBottom: 14,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  holderCol: { flex: 1, minWidth: 0 },
  metaCol: { flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  metaBlock: { alignItems: 'flex-end' },
  label: {
    color: 'rgba(196,181,253,0.85)',
    fontSize: 8.5,
    letterSpacing: 0.9,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  valueText: {
    color: '#F5F3FF',
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
