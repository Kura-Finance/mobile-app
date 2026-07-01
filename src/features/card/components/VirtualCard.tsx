import LoadingDots from '../../../shared/components/LoadingDots';
import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
export const CARD_WIDTH = SCREEN_WIDTH - 48;
export const CARD_HEIGHT = CARD_WIDTH * 0.58;

const CARD_COLORS: [string, string, ...string[]] = [
  '#FAFAFC',
  '#ECECF2',
  '#D8D8E2',
  '#F2F2F6',
];

export type CardOverlay =
  | { type: 'get_card'; onPress: () => void; isLoading?: boolean }
  | { type: 'pending'; onResume: () => void; isLoading?: boolean }
  | { type: 'under_review' }
  | { type: 'rejected'; reason?: string | null; onRetry?: () => void };

interface VirtualCardProps {
  masked: boolean;
  overlay?: CardOverlay;
  /** When true, shows PAN, cardholder, expiry and CVV on the card face. */
  showDetails?: boolean;
  showChevron?: boolean;
  last4?: string;
  expires?: string;
  cardHolder?: string;
}

function CardOverlayContent({ overlay }: { overlay: CardOverlay }) {
  const { t } = useTranslation();
  switch (overlay.type) {
    case 'get_card':
      return (
        <TouchableOpacity
          style={overlayStyles.overlayBtn}
          onPress={overlay.onPress}
          disabled={overlay.isLoading}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#7C3AED', '#4F46E5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={overlayStyles.overlayBtnGradient}
          >
            {overlay.isLoading ? (
              <LoadingDots compact color="#FFFFFF" size={6}    />
            ) : (
              <>
                <Ionicons name="card-outline" size={17} color="#FFFFFF" />
                <Text style={overlayStyles.overlayBtnText}>{t('card.applyNow')}</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      );

    case 'pending':
      return (
        <View style={overlayStyles.overlayStatus}>
          <View style={overlayStyles.overlayIconWrap}>
            {overlay.isLoading ? (
              <LoadingDots compact color="#F59E0B" size={6}    />
            ) : (
              <Ionicons name="time-outline" size={22} color="#F59E0B" />
            )}
          </View>
          <Text style={[overlayStyles.overlayTitle, { color: '#FCD34D' }]}>{t('card.underReview')}</Text>
          <Text style={overlayStyles.overlaySub}>{t('card.identityVerificationInProgress')}</Text>
          <TouchableOpacity
            style={[overlayStyles.overlayBtn, { marginTop: 12 }]}
            onPress={overlay.onResume}
            disabled={overlay.isLoading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['rgba(245,158,11,0.9)', 'rgba(217,119,6,0.9)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={overlayStyles.overlayBtnGradient}
            >
              <Ionicons name="refresh-outline" size={14} color="#FFFFFF" />
              <Text style={overlayStyles.overlayBtnText}>{t('card.resume')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      );

    case 'under_review':
      return (
        <View style={overlayStyles.overlayStatus}>
          <View style={overlayStyles.overlayIconWrap}>
            <LoadingDots compact color="#F59E0B" size={6}    />
          </View>
          <Text style={[overlayStyles.overlayTitle, { color: '#FCD34D' }]}>{t('card.underReview')}</Text>
          <Text style={overlayStyles.overlaySub}>{t('card.usually12BusinessDays')}</Text>
        </View>
      );

    case 'rejected':
      return (
        <View style={overlayStyles.overlayStatus}>
          <View style={[overlayStyles.overlayIconWrap, { backgroundColor: 'rgba(239,68,68,0.2)' }]}>
            <Ionicons name="close-circle-outline" size={22} color="#EF4444" />
          </View>
          <Text style={[overlayStyles.overlayTitle, { color: '#FCA5A5' }]}>{t('card.verificationFailed')}</Text>
          {overlay.reason ? (
            <Text style={overlayStyles.overlaySub} numberOfLines={2}>
              {overlay.reason}
            </Text>
          ) : (
            <Text style={overlayStyles.overlaySub}>{t('card.contactSupport')}</Text>
          )}
          {overlay.onRetry && (
            <TouchableOpacity
              style={[overlayStyles.overlayBtn, { marginTop: 12 }]}
              onPress={overlay.onRetry}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['rgba(239,68,68,0.85)', 'rgba(185,28,28,0.85)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={overlayStyles.overlayBtnGradient}
              >
                <Text style={overlayStyles.overlayBtnText}>{t('card.tryAgain')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      );
  }
}

function formatPan(masked: boolean, last4?: string): string {
  if (!masked) return '4242   4242   4242   4242';
  const suffix = last4 && last4 !== '••••' ? last4 : '••••';
  return `••••   ••••   ••••   ${suffix}`;
}

export default function VirtualCard({
  masked,
  overlay,
  showDetails = false,
  showChevron = false,
  last4,
  expires,
  cardHolder,
}: VirtualCardProps) {
  const { t } = useTranslation();
  const holder = cardHolder ?? t('card.kuraMember');
  const expiry = masked ? '••/••' : (expires ?? '12/28');
  const cvv = masked ? '•••' : '123';

  const overlayBg: [string, string] =
    overlay?.type === 'rejected'
      ? ['rgba(239,68,68,0.55)', 'rgba(153,27,27,0.72)']
      : ['rgba(248,250,252,0.82)', 'rgba(226,232,240,0.92)'];

  return (
    <LinearGradient
      colors={CARD_COLORS}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[faceStyles.card, { width: CARD_WIDTH, height: CARD_HEIGHT }]}
    >
        <View style={faceStyles.sheenStripe} pointerEvents="none" />
        <View style={faceStyles.glowOrbTop} pointerEvents="none" />
        <LinearGradient
          colors={['rgba(255,255,255,0.72)', 'rgba(255,255,255,0)', 'rgba(148,163,184,0.08)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1.2 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={faceStyles.topRow}>
          <View style={faceStyles.logoWrap}>
            <Image
              source={require('../../../../assets/card.webp')}
              style={faceStyles.brandLogo}
              resizeMode="contain"
            />
          </View>
        </View>

        <View style={faceStyles.chip}>
          <View style={faceStyles.chipInner} />
        </View>

        {showDetails ? (
          <>
            <Text style={faceStyles.number}>{formatPan(masked, last4)}</Text>
            <View style={faceStyles.bottomRow}>
              <View style={faceStyles.holderCol}>
                <Text style={faceStyles.label}>{t('card.cardHolder')}</Text>
                <Text style={faceStyles.valueText} numberOfLines={1}>
                  {holder}
                </Text>
              </View>
              <View style={faceStyles.metaCol}>
                <View style={faceStyles.metaBlock}>
                  <Text style={faceStyles.label}>{t('card.expires')}</Text>
                  <Text style={faceStyles.valueText}>{expiry}</Text>
                </View>
                <View style={faceStyles.metaBlock}>
                  <Text style={faceStyles.label}>{t('card.securityCode')}</Text>
                  <Text style={faceStyles.valueText}>{cvv}</Text>
                </View>
              </View>
            </View>
          </>
        ) : null}

        {showChevron && !overlay ? (
          <View style={faceStyles.chevronWrap} pointerEvents="none">
            <Ionicons name="chevron-forward" size={24} color="#64748B" />
          </View>
        ) : null}

        {overlay ? (
          <View style={overlayStyles.overlay}>
            <LinearGradient colors={overlayBg} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <CardOverlayContent overlay={overlay} />
          </View>
        ) : null}
    </LinearGradient>
  );
}

const faceStyles = StyleSheet.create({
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
  glowOrbTop: {
    position: 'absolute',
    top: -50,
    right: -30,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  logoWrap: {
    width: CARD_WIDTH * 0.11,
    height: CARD_HEIGHT * 0.22,
    justifyContent: 'center',
  },
  brandLogo: {
    width: CARD_WIDTH * 0.11,
    height: CARD_HEIGHT * 0.22,
  },
  chip: {
    width: 40,
    height: 30,
    borderRadius: 6,
    backgroundColor: 'rgba(212,175,55,0.28)',
    marginTop: 6,
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(180,140,40,0.45)',
  },
  chipInner: {
    width: 22,
    height: 16,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(160,120,30,0.4)',
  },
  number: {
    color: '#1E293B',
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
    color: '#94A3B8',
    fontSize: 8.5,
    letterSpacing: 0.9,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  valueText: {
    color: '#1E293B',
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.3,
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

const overlayStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayStatus: { alignItems: 'center', gap: 4 },
  overlayIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(245,158,11,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  overlayTitle: { fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  overlaySub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    textAlign: 'center',
    maxWidth: 200,
  },
  overlayBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  overlayBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  overlayBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
