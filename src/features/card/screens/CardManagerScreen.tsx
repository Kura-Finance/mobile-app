import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import CardPreviewCarousel, { type CardPreviewPage } from '../components/CardPreviewCarousel';
import CardProductDmPage from '../components/CardProductDmPage';
import MetalCardDmPage from '../components/MetalCardDmPage';
import { useTheme } from '../../../shared/theme/ThemeContext';
import LegalDisclaimer from '../../../shared/components/LegalDisclaimer';
import type { ThemeColors } from '../../../shared/theme/theme';
import { WAITLIST_PRODUCTS } from '../../../lib/api/waitlist';
import { KuraApiError } from '../../../lib/api/errors';
import { useWaitlistJoin } from '../../waitlist/hooks/useWaitlistJoin';

export type CardManagerParams = {
  CardManager: Record<string, never>;
};

export default function CardManagerScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const virtualWaitlist = useWaitlistJoin(WAITLIST_PRODUCTS.VIRTUAL_CARD);
  const metalWaitlist = useWaitlistJoin(WAITLIST_PRODUCTS.METAL_CARD);
  const [cardPreviewPage, setCardPreviewPage] = useState<CardPreviewPage>('virtual');
  const isMetalPreview = cardPreviewPage === 'metal';

  const submitWaitlist = useCallback(
    async (
      waitlist: ReturnType<typeof useWaitlistJoin>,
      joinedTitleKey: string,
      joinedBodyKey: string,
    ) => {
      if (!waitlist.hasRealEmail) {
        Alert.alert(t('waitlist.emailRequiredTitle'), t('waitlist.emailRequiredBody'));
        return;
      }
      if (waitlist.joined) {
        Alert.alert(t(joinedTitleKey), t(joinedBodyKey));
        return;
      }
      try {
        await waitlist.join();
        Alert.alert(t(joinedTitleKey), t(joinedBodyKey));
      } catch (error) {
        if (error instanceof Error && error.message === 'WAITLIST_UNAVAILABLE') {
          Alert.alert(t('waitlist.unavailableTitle'), t('waitlist.unavailableBody'));
          return;
        }
        if (error instanceof KuraApiError && error.isRateLimited()) {
          Alert.alert(t('waitlist.rateLimitTitle'), t('waitlist.rateLimitBody'));
          return;
        }
        const message =
          error instanceof KuraApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : t('waitlist.errorGeneric');
        Alert.alert(t('waitlist.errorTitle'), message);
      }
    },
    [t],
  );

  const handleVirtualNotify = useCallback(() => {
    void submitWaitlist(
      virtualWaitlist,
      'card.virtualNotifyTitle',
      'card.virtualNotifyBody',
    );
  }, [submitWaitlist, virtualWaitlist]);

  const handleMetalNotify = useCallback(() => {
    void submitWaitlist(
      metalWaitlist,
      'card.metalNotifyTitle',
      'card.metalNotifyBody',
    );
  }, [metalWaitlist, submitWaitlist]);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.navBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.screenTitle}>{t('card.cardManagerTitle')}</Text>
        <View style={s.navBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.cardPreview}>
          <CardPreviewCarousel
            virtualProps={{ showDetails: false, masked: true }}
            onPageChange={setCardPreviewPage}
          />
        </View>

        {isMetalPreview ? (
          <MetalCardDmPage
            onNotify={handleMetalNotify}
            notifyLoading={metalWaitlist.submitting || metalWaitlist.checking}
            notifyJoined={metalWaitlist.joined}
            notifyDisabled={!metalWaitlist.backendAvailable}
          />
        ) : (
          <CardProductDmPage
            onNotify={handleVirtualNotify}
            notifyLoading={virtualWaitlist.submitting || virtualWaitlist.checking}
            notifyJoined={virtualWaitlist.joined}
            notifyDisabled={!virtualWaitlist.backendAvailable}
          />
        )}

        <LegalDisclaimer variant="cardWaitlist" style={s.cardDisclaimer} />
      </ScrollView>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    navBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    screenTitle: { color: c.text, fontSize: 17, fontWeight: '700' },
    content: { paddingHorizontal: 20, gap: 8 },
    cardPreview: { marginBottom: 8 },
    cardDisclaimer: { marginTop: 8 },
  });
}
