import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Switch,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import CardPreviewCarousel, { type CardPreviewPage } from '../components/CardPreviewCarousel';
import MetalCardDmPage from '../components/MetalCardDmPage';
import GnosisPayOnboardingScreen from './GnosisPayOnboardingScreen';
import { useGnosisPayOnboarding } from '../hooks/useGnosisPayOnboarding';
import {
  freezeGpCard,
  unfreezeGpCard,
  getGpCardStatus,
  setGpDailyLimit,
  type GpCardStatus,
  type GpOnboardingStatus,
} from '../../../lib/api/gp';
import { useTheme } from '../../../shared/theme/ThemeContext';
import LegalDisclaimer from '../../../shared/components/LegalDisclaimer';
import type { ThemeColors } from '../../../shared/theme/theme';
import { WAITLIST_PRODUCTS } from '../../../lib/api/waitlist';
import { KuraApiError } from '../../../lib/api/errors';
import { useWaitlistJoin } from '../../waitlist/hooks/useWaitlistJoin';

export type CardManagerParams = {
  CardManager: {
    cardId?: string;
    last4?: string;
    status?: GpCardStatus;
    safeAddress?: string | null;
  };
};

function formatUsdc(amount: number, currency = 'USDC'): string {
  return `$${amount.toFixed(2)} ${currency}`;
}

function statusLabel(status: GpCardStatus, frozen: boolean, t: (k: string) => string): string {
  if (frozen || status === 'frozen') return t('card.cardFrozen');
  if (status === 'active') return t('card.active');
  if (status === 'issuing') return t('card.cardIssuing');
  if (status === 'cancelled') return t('card.cardCancelled');
  return t('card.cardUnknown');
}

interface DetailRowProps {
  label: string;
  value: string;
  mono?: boolean;
  copyValue?: string;
  colors: ThemeColors;
}

function DetailRow({ label, value, mono, copyValue, colors }: DetailRowProps) {
  const { t } = useTranslation();
  const rs = useMemo(() => detailRowStyles(colors), [colors]);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!copyValue) return;
    await Clipboard.setStringAsync(copyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [copyValue]);

  return (
    <View style={rs.row}>
      <Text style={rs.label}>{label}</Text>
      <View style={rs.valueRow}>
        <Text style={[rs.value, mono && rs.mono]} selectable={!!copyValue}>
          {value}
        </Text>
        {copyValue ? (
          <TouchableOpacity onPress={() => void handleCopy()} hitSlop={8} activeOpacity={0.7}>
            <Ionicons
              name={copied ? 'checkmark-circle' : 'copy-outline'}
              size={18}
              color={copied ? colors.success : colors.textFaint}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      {copied ? <Text style={rs.copiedHint}>{t('card.copied')}</Text> : null}
    </View>
  );
}

function detailRowStyles(c: ThemeColors) {
  return StyleSheet.create({
    row: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      gap: 6,
    },
    label: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    valueRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    value: { color: c.text, fontSize: 14, fontWeight: '500', flex: 1 },
    mono: { fontFamily: 'monospace', fontSize: 13 },
    copiedHint: { color: c.success, fontSize: 11, fontWeight: '600' },
  });
}

export default function CardManagerScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<CardManagerParams, 'CardManager'>>();

  const onboarding = useGnosisPayOnboarding();
  const { step, card: gpCard, gpSafeAddress, refresh: refreshOnboarding } = onboarding;
  const metalWaitlist = useWaitlistJoin(WAITLIST_PRODUCTS.METAL_CARD);

  const routeCardId = route.params?.cardId ?? '';
  const routeLast4 = route.params?.last4 ?? '';
  const routeStatus = route.params?.status ?? 'active';
  const routeSafeAddress = route.params?.safeAddress ?? null;

  const isComplete = step === 'complete' && !!gpCard;
  const cardId = gpCard?.id ?? routeCardId;
  const last4 = gpCard?.last4 ?? routeLast4;
  const initialStatus = gpCard?.status ?? routeStatus;

  const [loading, setLoading] = useState(false);
  const [statusData, setStatusData] = useState<GpOnboardingStatus | null>(null);
  const [frozen, setFrozen] = useState(initialStatus === 'frozen');
  const [togglingFreeze, setTogglingFreeze] = useState(false);
  const [limitInput, setLimitInput] = useState('');
  const [savingLimit, setSavingLimit] = useState(false);
  const [cardPreviewPage, setCardPreviewPage] = useState<CardPreviewPage>('virtual');

  const spending = statusData?.spending;
  const safeAddress = statusData?.safeAddress ?? gpSafeAddress ?? routeSafeAddress;
  const card = statusData?.card ?? gpCard;
  const cardStatus = card?.status ?? initialStatus;

  const loadStatus = useCallback(async () => {
    if (!isComplete || !cardId) return;
    setLoading(true);
    try {
      const data = await getGpCardStatus();
      setStatusData(data);
      if (data.card?.status) {
        setFrozen(data.card.status === 'frozen');
      }
      if (data.spending?.dailyLimit != null) {
        setLimitInput(String(Math.round(data.spending.dailyLimit)));
      }
    } catch {
      // keep existing state
    } finally {
      setLoading(false);
    }
  }, [cardId, isComplete]);

  useEffect(() => {
    if (isComplete) {
      void loadStatus();
    }
  }, [isComplete, loadStatus]);

  useEffect(() => {
    if (gpCard?.status) {
      setFrozen(gpCard.status === 'frozen');
    }
  }, [gpCard?.status]);

  const handleRefresh = useCallback(async () => {
    await refreshOnboarding();
    if (isComplete) {
      await loadStatus();
    }
  }, [refreshOnboarding, isComplete, loadStatus]);

  const toggleFreeze = useCallback(async (nextFrozen: boolean) => {
    if (!cardId || togglingFreeze) return;
    setTogglingFreeze(true);
    const prev = frozen;
    setFrozen(nextFrozen);
    try {
      if (nextFrozen) {
        await freezeGpCard(cardId);
      } else {
        await unfreezeGpCard(cardId);
      }
    } catch {
      setFrozen(prev);
      Alert.alert(t('card.somethingWentWrong'), t('card.cardActionFailed'));
    } finally {
      setTogglingFreeze(false);
    }
  }, [cardId, frozen, togglingFreeze, t]);

  const saveLimit = useCallback(async () => {
    const parsed = Number(limitInput.replace(/,/g, ''));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert(t('card.invalidLimitTitle'), t('card.invalidLimitBody'));
      return;
    }
    setSavingLimit(true);
    try {
      await setGpDailyLimit(parsed);
      await loadStatus();
      Alert.alert(t('card.limitUpdatedTitle'), t('card.limitUpdatedBody'));
    } catch {
      Alert.alert(t('card.somethingWentWrong'), t('card.limitUpdateFailed'));
    } finally {
      setSavingLimit(false);
    }
  }, [limitInput, loadStatus, t]);

  const handleMetalNotify = useCallback(async () => {
    if (!metalWaitlist.hasRealEmail) {
      Alert.alert(t('waitlist.emailRequiredTitle'), t('waitlist.emailRequiredBody'));
      return;
    }
    if (metalWaitlist.joined) {
      Alert.alert(t('card.metalNotifyTitle'), t('card.metalNotifyBody'));
      return;
    }
    try {
      await metalWaitlist.join();
      Alert.alert(t('card.metalNotifyTitle'), t('card.metalNotifyBody'));
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
  }, [metalWaitlist, t]);

  const dailyPct = spending && spending.dailyLimit > 0
    ? Math.min(100, (spending.dailySpent / spending.dailyLimit) * 100)
    : 0;

  const displayLast4 = last4;
  const isMetalPreview = cardPreviewPage === 'metal';

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.navBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.screenTitle}>{t('card.cardManagerTitle')}</Text>
        <TouchableOpacity onPress={() => void handleRefresh()} style={s.navBtn} hitSlop={8}>
          {(loading || step === 'loading')
            ? <ActivityIndicator size="small" color={colors.textMuted} />
            : <Ionicons name="refresh-outline" size={20} color={colors.textMuted} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.cardPreview}>
          <CardPreviewCarousel
            virtualProps={{
              showDetails: isComplete && !isMetalPreview,
              masked: true,
              last4: displayLast4 || undefined,
            }}
            onPageChange={setCardPreviewPage}
          />
        </View>

        {step === 'loading' ? (
          <View style={s.loadingBlock}>
            <ActivityIndicator color={colors.primary} />
            <Text style={s.loadingText}>{t('card.loadingKuraCard')}</Text>
          </View>
        ) : !isComplete ? (
          isMetalPreview ? (
            <View style={s.comingSoonBlock}>
              <MetalCardDmPage
                onNotify={() => { void handleMetalNotify(); }}
                notifyLoading={metalWaitlist.submitting || metalWaitlist.checking}
                notifyJoined={metalWaitlist.joined}
                notifyDisabled={!metalWaitlist.backendAvailable}
              />
            </View>
          ) : (
            <View style={s.onboardingWrap}>
              <GnosisPayOnboardingScreen embedded onboarding={onboarding} />
            </View>
          )
        ) : (
          <>
            {!isMetalPreview ? (
              <>
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('card.cardControls')}</Text>
              <View style={s.controlRow}>
                <View style={s.controlLeft}>
                  <Ionicons
                    name={frozen ? 'snow-outline' : 'flash-outline'}
                    size={20}
                    color={frozen ? colors.primary : colors.success}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={s.controlTitle}>
                      {frozen ? t('card.unfreezeCard') : t('card.freezeCard')}
                    </Text>
                    <Text style={s.controlSub}>
                      {frozen ? t('card.unfreezeCardSub') : t('card.freezeCardSub')}
                    </Text>
                  </View>
                </View>
                {togglingFreeze
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : (
                    <Switch
                      value={frozen}
                      onValueChange={(v) => void toggleFreeze(v)}
                      trackColor={{ false: colors.border, true: colors.primarySoft }}
                      thumbColor={frozen ? colors.primary : colors.surface}
                    />
                  )}
              </View>
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('card.spendingLimits')}</Text>
              <View style={s.cardBox}>
                {spending ? (
                  <>
                    <View style={s.limitHeader}>
                      <Text style={s.limitLabel}>{t('card.dailyLimit')}</Text>
                      <Text style={s.limitValue}>
                        {formatUsdc(spending.dailySpent, spending.currency)} / {formatUsdc(spending.dailyLimit, spending.currency)}
                      </Text>
                    </View>
                    <View style={s.progressTrack}>
                      <View style={[s.progressFill, { width: `${dailyPct}%` }]} />
                    </View>
                    {spending.monthlySpent != null ? (
                      <Text style={s.monthlyNote}>
                        {t('card.monthlySpent', {
                          amount: formatUsdc(spending.monthlySpent, spending.currency),
                        })}
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <Text style={s.emptyNote}>{t('card.limitDataUnavailable')}</Text>
                )}

                <View style={s.limitEdit}>
                  <Text style={s.limitEditLabel}>{t('card.setDailyLimit')}</Text>
                  <View style={s.limitInputRow}>
                    <Text style={s.currencyPrefix}>$</Text>
                    <TextInput
                      style={s.limitInput}
                      value={limitInput}
                      onChangeText={setLimitInput}
                      keyboardType="numeric"
                      placeholder="500"
                      placeholderTextColor={colors.textFaint}
                    />
                    <Text style={s.currencySuffix}>USDC</Text>
                  </View>
                  <TouchableOpacity
                    style={[s.saveBtn, savingLimit && s.saveBtnDisabled]}
                    onPress={() => void saveLimit()}
                    disabled={savingLimit}
                    activeOpacity={0.85}
                  >
                    {savingLimit
                      ? <ActivityIndicator size="small" color="#FFFFFF" />
                      : <Text style={s.saveBtnText}>{t('card.saveLimit')}</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
              </>
            ) : null}

            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('card.cardDetails')}</Text>
              <View style={s.cardBox}>
                <DetailRow
                  label={t('card.cardType')}
                  value={isMetalPreview ? t('card.metalCardTitle') : t('card.virtualVisa')}
                  colors={colors}
                />
                {isMetalPreview ? (
                  <>
                    <DetailRow
                      label={t('card.cardStatus')}
                      value={t('card.comingSoon')}
                      colors={colors}
                    />
                    <DetailRow
                      label={t('card.cardHolder')}
                      value={t('card.kuraMember')}
                      colors={colors}
                    />
                  </>
                ) : (
                  <>
                    <DetailRow
                      label={t('card.cardNumber')}
                      value={`••••   ••••   ••••   ${displayLast4 || '••••'}`}
                      mono
                      colors={colors}
                    />
                    <DetailRow
                      label={t('card.cardStatus')}
                      value={statusLabel(cardStatus, frozen, t)}
                      colors={colors}
                    />
                    <DetailRow
                      label={t('card.cardHolder')}
                      value={t('card.kuraMember')}
                      colors={colors}
                    />
                    <DetailRow
                      label={t('card.securityCode')}
                      value="•••"
                      colors={colors}
                    />
                    {safeAddress ? (
                      <DetailRow
                        label={t('card.onChainWallet')}
                        value={safeAddress}
                        mono
                        copyValue={safeAddress}
                        colors={colors}
                      />
                    ) : null}
                    {cardId ? (
                      <DetailRow
                        label={t('card.cardId')}
                        value={cardId.length > 16 ? `${cardId.slice(0, 8)}…${cardId.slice(-6)}` : cardId}
                        mono
                        copyValue={cardId}
                        colors={colors}
                      />
                    ) : null}
                  </>
                )}
              </View>
              <Text style={s.detailsNote}>
                {isMetalPreview ? t('card.metalCardDetailsNote') : t('card.sensitiveDetailsNote')}
              </Text>
            </View>
          </>
        )}
        <LegalDisclaimer variant="gnosisPayCard" style={s.cardDisclaimer} />
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
      paddingHorizontal: 12,
      paddingBottom: 8,
    },
    navBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    screenTitle: {
      flex: 1,
      textAlign: 'center',
      color: c.text,
      fontSize: 17,
      fontWeight: '700',
    },
    content: { paddingHorizontal: 20, paddingTop: 8, gap: 20 },
    cardPreview: { alignItems: 'center', marginBottom: 4 },
    loadingBlock: { alignItems: 'center', gap: 12, paddingVertical: 32 },
    loadingText: { color: c.textMuted, fontSize: 14 },
    onboardingWrap: { marginTop: -4 },
    comingSoonBlock: { marginTop: -4 },
    section: { gap: 10 },
    sectionTitle: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    controlRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    controlLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    controlTitle: { color: c.text, fontSize: 15, fontWeight: '600' },
    controlSub: { color: c.textMuted, fontSize: 12, marginTop: 2, lineHeight: 17 },
    cardBox: {
      backgroundColor: c.surface,
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    limitHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
      gap: 8,
    },
    limitLabel: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    limitValue: { color: c.text, fontSize: 12, fontWeight: '600' },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: c.surfaceAlt,
      marginHorizontal: 16,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: 3, backgroundColor: c.primary },
    monthlyNote: {
      color: c.textFaint,
      fontSize: 11,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
    },
    emptyNote: {
      color: c.textMuted,
      fontSize: 13,
      padding: 16,
    },
    limitEdit: {
      padding: 16,
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      marginTop: 8,
    },
    limitEditLabel: { color: c.text, fontSize: 13, fontWeight: '600' },
    limitInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surfaceAlt,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingHorizontal: 12,
    },
    currencyPrefix: { color: c.textMuted, fontSize: 16, fontWeight: '600', marginRight: 4 },
    limitInput: {
      flex: 1,
      color: c.text,
      fontSize: 18,
      fontWeight: '700',
      paddingVertical: 12,
    },
    currencySuffix: { color: c.textFaint, fontSize: 13, fontWeight: '600' },
    saveBtn: {
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    detailsNote: {
      color: c.textFaint,
      fontSize: 11,
      lineHeight: 16,
      paddingHorizontal: 4,
    },
    cardDisclaimer: {
      marginTop: 8,
      marginBottom: 24,
      paddingHorizontal: 4,
    },
  });
}
