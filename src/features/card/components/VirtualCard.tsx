import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
export const CARD_WIDTH = SCREEN_WIDTH - 48;
export const CARD_HEIGHT = CARD_WIDTH * 0.58;

// ─────────────────────────────────────────────────────────────────────────────
// Overlay state union
// ─────────────────────────────────────────────────────────────────────────────

export type CardOverlay =
  | { type: 'get_card';    onPress: () => void; isLoading?: boolean }
  | { type: 'pending';     onResume: () => void; isLoading?: boolean }
  | { type: 'under_review' }
  | { type: 'rejected';    reason?: string | null; onRetry?: () => void };

interface VirtualCardProps {
  balance: string;
  masked: boolean;
  overlay?: CardOverlay;
}

// ─────────────────────────────────────────────────────────────────────────────
// Overlay content
// ─────────────────────────────────────────────────────────────────────────────

function CardOverlayContent({ overlay }: { overlay: CardOverlay }) {
  const { t } = useTranslation();
  switch (overlay.type) {
    case 'get_card':
      return (
        <TouchableOpacity
          style={s.overlayBtn}
          onPress={overlay.onPress}
          disabled={overlay.isLoading}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#7C3AED', '#4F46E5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.overlayBtnGradient}
          >
            {overlay.isLoading
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <>
                  <Ionicons name="card-outline" size={17} color="#FFFFFF" />
                  <Text style={s.overlayBtnText}>{t('card.getCard')}</Text>
                </>
            }
          </LinearGradient>
        </TouchableOpacity>
      );

    case 'pending':
      return (
        <View style={s.overlayStatus}>
          <View style={s.overlayIconWrap}>
            {overlay.isLoading
              ? <ActivityIndicator size="small" color="#F59E0B" />
              : <Ionicons name="time-outline" size={22} color="#F59E0B" />
            }
          </View>
          <Text style={[s.overlayTitle, { color: '#FCD34D' }]}>{t('card.underReview')}</Text>
          <Text style={s.overlaySub}>{t('card.identityVerificationInProgress')}</Text>
          <TouchableOpacity
            style={[s.overlayBtn, { marginTop: 12 }]}
            onPress={overlay.onResume}
            disabled={overlay.isLoading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['rgba(245,158,11,0.9)', 'rgba(217,119,6,0.9)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.overlayBtnGradient}
            >
              <Ionicons name="refresh-outline" size={14} color="#FFFFFF" />
              <Text style={s.overlayBtnText}>{t('card.resume')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      );

    case 'under_review':
      return (
        <View style={s.overlayStatus}>
          <View style={s.overlayIconWrap}>
            <ActivityIndicator size="small" color="#F59E0B" />
          </View>
          <Text style={[s.overlayTitle, { color: '#FCD34D' }]}>{t('card.underReview')}</Text>
          <Text style={s.overlaySub}>{t('card.usually12BusinessDays')}</Text>
        </View>
      );

    case 'rejected':
      return (
        <View style={s.overlayStatus}>
          <View style={[s.overlayIconWrap, { backgroundColor: 'rgba(239,68,68,0.2)' }]}>
            <Ionicons name="close-circle-outline" size={22} color="#EF4444" />
          </View>
          <Text style={[s.overlayTitle, { color: '#FCA5A5' }]}>{t('card.verificationFailed')}</Text>
          {overlay.reason
            ? <Text style={s.overlaySub} numberOfLines={2}>{overlay.reason}</Text>
            : <Text style={s.overlaySub}>{t('card.contactSupport')}</Text>
          }
          {overlay.onRetry && (
            <TouchableOpacity
              style={[s.overlayBtn, { marginTop: 12 }]}
              onPress={overlay.onRetry}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['rgba(239,68,68,0.85)', 'rgba(185,28,28,0.85)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.overlayBtnGradient}
              >
                <Text style={s.overlayBtnText}>{t('card.tryAgain')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────────────────────────────────────

export default function VirtualCard({ balance, masked, overlay }: VirtualCardProps) {
  const { t } = useTranslation();
  const bgColors: [string, string] =
    overlay?.type === 'rejected'
      ? ['rgba(239,68,68,0.55)', 'rgba(153,27,27,0.72)']
      : ['rgba(11,11,15,0.55)', 'rgba(11,11,15,0.72)'];

  return (
    <View style={[s.shadow, { width: CARD_WIDTH, height: CARD_HEIGHT }]}>
      <LinearGradient
        colors={['#FFFFFF', '#F2F2F7', '#E8E8ED', '#F5F5F8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.card, { width: CARD_WIDTH, height: CARD_HEIGHT }]}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0)', 'rgba(200,200,210,0.2)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1.2 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <Image
          source={require('../../../../assets/card.webp')}
          style={s.art}
          resizeMode="contain"
        />
        <View style={s.topRow}>
          <View style={{ flex: 1 }} />
          <View style={s.networkBadge}>
            <Text style={s.networkText}>VISA</Text>
          </View>
        </View>
        <View style={s.chip}>
          <View style={s.chipInner} />
        </View>
        <Text style={s.number}>
          {masked ? '••••   ••••   ••••   ••••' : '4242   4242   4242   4242'}
        </Text>
        <View style={s.bottomRow}>
          <View>
            <Text style={s.label}>{t('card.cardHolder')}</Text>
            <Text style={s.value}>{t('card.kuraMember')}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.label}>{t('card.expires')}</Text>
            <Text style={s.value}>12/28</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.label}>{t('card.balance')}</Text>
            <Text style={[s.value, { color: '#6D28D9' }]}>{balance}</Text>
          </View>
        </View>

        {overlay && (
          <View style={s.overlay}>
            <LinearGradient colors={bgColors} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <CardOverlayContent overlay={overlay} />
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  shadow: {
    borderRadius: 22,
    shadowColor: '#8B9BB4',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.32,
    shadowRadius: 32,
    elevation: 20,
  },
  card: {
    borderRadius: 22,
    padding: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  art: {
    position: 'absolute',
    top: 8,
    left: 14,
    width: CARD_WIDTH * 0.11,
    height: CARD_HEIGHT * 0.26,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  networkBadge: {
    backgroundColor: 'rgba(28,28,36,0.72)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  networkText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  chip: {
    width: 36,
    height: 26,
    borderRadius: 5,
    backgroundColor: 'rgba(190,158,70,0.22)',
    marginTop: 10,
    marginBottom: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(190,158,70,0.45)',
  },
  chipInner: { width: 18, height: 14, borderRadius: 3, borderWidth: 1, borderColor: 'rgba(190,158,70,0.4)' },
  number: {
    color: '#3A3A48',
    fontSize: 15.5,
    letterSpacing: 2.8,
    fontFamily: 'monospace',
    marginBottom: 18,
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  label: { color: '#A0A8B8', fontSize: 8.5, letterSpacing: 0.8, marginBottom: 3, textTransform: 'uppercase' },
  value: { color: '#1C1C28', fontSize: 12.5, fontWeight: '600', letterSpacing: 0.2 },

  // Overlay
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
  overlaySub: { color: 'rgba(255,255,255,0.6)', fontSize: 11, textAlign: 'center', maxWidth: 200 },

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
