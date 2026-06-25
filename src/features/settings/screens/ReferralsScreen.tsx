import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAppStore } from '../../../shared/store/useAppStore';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { brand } from '../../../config/branding';
import {
  fetchCashbackHistory,
  fetchCurrentUserProfile,
  type CashbackHistoryItem,
  type CashbackHistorySummary,
  type CashbackStatus,
} from '../../../lib/api/auth/me';
import { KuraApiError } from '../../../lib/api/errors';
import {
  formatCashbackDate,
  formatReferralUsd,
  formatReferredUserLabel,
} from '../../../lib/referral/referralDisplay';

interface Props {
  onClose: () => void;
}

const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{4,32}$/;

type CashbackTab = CashbackStatus;

export default function ReferralsScreen({ onClose }: Props) {
  const { t } = useAppTranslation();
  const { colors } = useTheme();
  const referCode = useAppStore((s) => s.userProfile.referCode);
  const referredByCode = useAppStore((s) => s.userProfile.referredByCode);
  const referralCount = useAppStore((s) => s.userProfile.referralCount ?? 0);
  const cashbackBalance = useAppStore((s) => s.userProfile.cashbackBalance ?? 0);
  const refreshUserProfile = useAppStore((s) => s.refreshUserProfile);
  const applyReferralCode = useAppStore((s) => s.setReferralCode);

  const [profileLoading, setProfileLoading] = useState(true);
  const [codeInput, setCodeInput] = useState('');
  const [applyLoading, setApplyLoading] = useState(false);
  const [cashbackTab, setCashbackTab] = useState<CashbackTab>('pending');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<CashbackHistoryItem[]>([]);
  const [historySummary, setHistorySummary] = useState<CashbackHistorySummary | null>(null);

  const referralLink = referCode
    ? `${brand.signupUrl}?ref=${encodeURIComponent(referCode)}`
    : null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const profile = await fetchCurrentUserProfile();
        if (!cancelled) refreshUserProfile(profile);
      } catch {
        // keep cached profile
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshUserProfile]);

  const loadCashbackHistory = useCallback(async (status: CashbackTab) => {
    setHistoryLoading(true);
    try {
      const data = await fetchCashbackHistory({ status, limit: 50 });
      setHistoryItems(data.items);
      setHistorySummary(data.summary);
    } catch {
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCashbackHistory(cashbackTab);
  }, [cashbackTab, loadCashbackHistory]);

  const copyValue = async (value: string, messageKey: string) => {
    await Clipboard.setStringAsync(value);
    Alert.alert(t('settings.referralsCopiedTitle'), t(messageKey));
  };

  const handleShare = async () => {
    if (!referCode || !referralLink) return;
    try {
      await Share.share({
        message: t('settings.referralsShareMessage', { code: referCode, link: referralLink }),
      });
    } catch {
      // user cancelled share sheet
    }
  };

  const handleApplyCode = async () => {
    const normalized = codeInput.trim().toUpperCase();
    if (!REFERRAL_CODE_PATTERN.test(normalized)) {
      Alert.alert(t('settings.referralsApplyErrorTitle'), t('settings.referralsApplyInvalidFormat'));
      return;
    }

    try {
      setApplyLoading(true);
      await applyReferralCode(normalized);
      setCodeInput('');
      Alert.alert(t('settings.referralsApplySuccessTitle'), t('settings.referralsApplySuccessMessage'));
    } catch (error) {
      const message =
        error instanceof KuraApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : t('settings.referralsApplyErrorGeneric');
      Alert.alert(t('settings.referralsApplyErrorTitle'), message);
    } finally {
      setApplyLoading(false);
    }
  };

  const cardStyle = {
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  };

  const tabLabels: Record<CashbackTab, string> = {
    pending: t('settings.referralsCashbackTabPending'),
    available: t('settings.referralsCashbackTabAvailable'),
    reversed: t('settings.referralsCashbackTabReversed'),
  };

  const statusLabel = (status: CashbackStatus): string => {
    if (status === 'pending') return t('settings.referralsCashbackStatusPending');
    if (status === 'available') return t('settings.referralsCashbackStatusAvailable');
    return t('settings.referralsCashbackStatusReversed');
  };

  const referredUserLabel = (item: CashbackHistoryItem): string => {
    const masked = formatReferredUserLabel(item.referredUserEmail);
    return masked ?? t('settings.referralsCashbackAnonymousUser');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1, paddingTop: 64, paddingHorizontal: 24 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>
            {t('settings.referrals')}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={{
              width: 32,
              height: 32,
              backgroundColor: colors.surface,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {profileLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginBottom: 24 }} />
        ) : null}

        <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 21, marginBottom: 24 }}>
          {t('settings.referralsDescription')}
        </Text>

        <View style={cardStyle}>
          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
            {t('settings.referralsCashbackBalanceLabel')}
          </Text>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800' }}>
            {formatReferralUsd(cashbackBalance)}
          </Text>
          {historySummary ? (
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>
              {t('settings.referralsCashbackTotalEarned', {
                amount: formatReferralUsd(historySummary.totalEarned),
              })}
            </Text>
          ) : null}
        </View>

        <View style={cardStyle}>
          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
            {t('settings.referralsYourCode')}
          </Text>
          {referCode ? (
            <>
              <TouchableOpacity
                onPress={() => { void copyValue(referCode, 'settings.referralsCodeCopied'); }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  paddingVertical: 4,
                }}
                activeOpacity={0.75}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 28,
                    fontWeight: '800',
                    letterSpacing: 1,
                    flex: 1,
                  }}
                >
                  {referCode}
                </Text>
                <Ionicons name="copy-outline" size={22} color={colors.textMuted} />
              </TouchableOpacity>

              {referralLink ? (
                <>
                  <View
                    style={{
                      height: 1,
                      backgroundColor: colors.primarySoft,
                      marginVertical: 16,
                    }}
                  />
                  <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
                    {t('settings.referralsLinkLabel')}
                  </Text>
                  <TouchableOpacity
                    onPress={() => { void copyValue(referralLink, 'settings.referralsLinkCopied'); }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                      paddingVertical: 4,
                    }}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={{
                        color: colors.primary,
                        fontSize: 14,
                        lineHeight: 20,
                        flex: 1,
                      }}
                    >
                      {referralLink}
                    </Text>
                    <Ionicons name="copy-outline" size={22} color={colors.textMuted} />
                  </TouchableOpacity>
                </>
              ) : null}

              <TouchableOpacity
                onPress={() => { void handleShare(); }}
                style={{
                  marginTop: 16,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                }}
                activeOpacity={0.75}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>{t('settings.referralsShare')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: 1 }}>
              {t('settings.notSet')}
            </Text>
          )}
        </View>

        <View style={cardStyle}>
          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
            {t('settings.referralsInvitedByLabel')}
          </Text>
          {referredByCode ? (
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700', letterSpacing: 1 }}>
              {t('settings.referralsInvitedByApplied', { code: referredByCode })}
            </Text>
          ) : (
            <>
              <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: 12 }}>
                {t('settings.referralsApplyHint')}
              </Text>
              <TextInput
                value={codeInput}
                onChangeText={setCodeInput}
                placeholder={t('settings.referralsApplyPlaceholder')}
                placeholderTextColor={colors.textFaint}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!applyLoading}
                style={{
                  backgroundColor: colors.surfaceInput,
                  borderWidth: 1,
                  borderColor: colors.primarySoft,
                  borderRadius: 10,
                  color: colors.text,
                  padding: 14,
                  fontSize: 16,
                  letterSpacing: 1,
                  marginBottom: 12,
                  opacity: applyLoading ? 0.6 : 1,
                }}
              />
              <TouchableOpacity
                onPress={() => { void handleApplyCode(); }}
                disabled={applyLoading || codeInput.trim().length === 0}
                style={{
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor:
                    applyLoading || codeInput.trim().length === 0 ? colors.primaryDark : colors.primary,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                }}
                activeOpacity={0.75}
              >
                {applyLoading ? (
                  <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} />
                ) : null}
                <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>
                  {applyLoading ? t('settings.referralsApplying') : t('settings.referralsApplyButton')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={cardStyle}>
          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
            {t('settings.referralsCountLabel')}
          </Text>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>{referralCount}</Text>
        </View>

        <View style={{ ...cardStyle, marginBottom: 8 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
            {t('settings.referralsCashbackHistoryTitle')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {(['pending', 'available', 'reversed'] as CashbackTab[]).map((tab) => {
              const active = cashbackTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setCashbackTab(tab)}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: active ? colors.primary : colors.surfaceInput,
                    alignItems: 'center',
                  }}
                  activeOpacity={0.75}
                >
                  <Text
                    style={{
                      color: active ? '#FFFFFF' : colors.textMuted,
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    {tabLabels[tab]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {historyLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
          ) : historyItems.length === 0 ? (
            <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 16 }}>
              {t('settings.referralsCashbackEmpty')}
            </Text>
          ) : (
            historyItems.map((item) => (
              <View
                key={item.id}
                style={{
                  paddingVertical: 12,
                  borderTopWidth: 1,
                  borderTopColor: colors.primarySoft,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ color: colors.text, fontWeight: '600', flex: 1, marginRight: 8 }}>
                    {referredUserLabel(item)}
                  </Text>
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>
                    {formatReferralUsd(item.cashbackAmount)}
                  </Text>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 2 }}>
                  {t('settings.referralsCashbackOrderAmount', {
                    amount: formatReferralUsd(item.grossAmount),
                  })}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {statusLabel(item.status)}
                  {item.status === 'pending' && item.availableAt
                    ? ` · ${t('settings.referralsCashbackAvailableOn', {
                        date: formatCashbackDate(item.availableAt),
                      })}`
                    : ''}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={{ ...cardStyle, marginBottom: 0 }}>
          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
            {t('settings.referralsRulesTitle')}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20 }}>
            {t('settings.referralsRulesBody')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
