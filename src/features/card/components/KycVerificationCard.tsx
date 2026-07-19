import LoadingDots from '../../../shared/components/LoadingDots';
/**
 * KycVerificationCard
 *
 * Shared identity-verification gate for the Bridge on/off-ramp flows.
 * Individual KYC only — uses the signed-in user's name / email and
 * `POST /api/bridge/kyc-link`.
 *
 * The card is purely presentational; the parent owns the `createKycLink`
 * call and the resulting browser hand-off.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { BridgeCustomer, KycLinkRequest } from '../../../lib/api/ramp/client';
import {
  customerNeedsKycAdditionalInfo,
  getCustomerFacingRejectionReasons,
  getKycUiPhase,
  isKycPaused,
  normalizeKycStatus,
} from '../../../lib/api/ramp/bridgeKyc';
import { brand } from '../../../config/branding';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

interface KycVerificationCardProps {
  customer: BridgeCustomer | null;
  /** Signed-in user's display name, used to prefill individual KYC. */
  defaultName?: string;
  /** Signed-in user's email, used to prefill individual KYC. */
  defaultEmail?: string;
  /** True when the Kura profile still has a placeholder email — Bridge KYC blocked. */
  needsEmailLink?: boolean;
  /** True while the parent's createKycLink request is in flight. */
  creating: boolean;
  /** Purpose copy, e.g. "deposit fiat" or "withdraw to a bank account". */
  purpose: string;
  onStartKyc: (req: KycLinkRequest) => void;
  onRefresh: () => void;
}

export default function KycVerificationCard({
  customer,
  defaultName,
  defaultEmail,
  needsEmailLink = false,
  creating,
  purpose,
  onStartKyc,
  onRefresh,
}: KycVerificationCardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const c = useStyles();

  const phase = getKycUiPhase(customer?.kycStatus, customer?.bridgeCustomerId);
  const status = normalizeKycStatus(customer?.kycStatus);
  const needsMoreInfo = customerNeedsKycAdditionalInfo(customer);
  const paused = isKycPaused(customer?.kycStatus) || phase === 'paused';
  const inReview = !needsMoreInfo && !paused && (phase === 'in_review' || phase === 'unknown');
  const rejected = status === 'rejected';
  const bridgeReasons = getCustomerFacingRejectionReasons(customer);
  const isLegacyBusinessCustomer = customer?.customerType === 'business';

  const individualEmail = defaultEmail?.trim() ?? '';
  const individualEmailValid = /\S+@\S+\.\S+/.test(individualEmail);
  const canStart = !needsEmailLink && individualEmailValid;

  const handleStart = () => {
    onStartKyc({
      type: 'individual',
      fullName: defaultName?.trim() || 'Kura User',
      email: individualEmail,
    });
  };

  if (isLegacyBusinessCustomer && !customer?.canTransact) {
    return (
      <View style={c.card}>
        <View style={c.iconWrap}>
          <Ionicons name="business-outline" size={24} color={colors.textMuted} />
        </View>
        <Text style={c.title}>{t('card.businessVerificationUnsupportedTitle')}</Text>
        <Text style={c.text}>{t('card.businessVerificationUnsupportedBody')}</Text>
        <SupportContactLink />
        <RefreshLink onRefresh={onRefresh} />
      </View>
    );
  }

  if (paused) {
    return (
      <View style={c.card}>
        <View style={[c.iconWrap, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
          <Ionicons name="pause-circle-outline" size={24} color="#EF4444" />
        </View>
        <Text style={c.title}>{t('card.verificationPausedTitle')}</Text>
        {bridgeReasons.length > 0 ? (
          <View style={c.reasonList}>
            {bridgeReasons.map((reason) => (
              <Text key={reason} style={c.reasonText}>
                {reason}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={c.text}>{t('card.verificationPausedBody')}</Text>
        )}
        <SupportContactLink />
        <RefreshLink onRefresh={onRefresh} />
      </View>
    );
  }

  // Bridge won't push a new link — reopen hosted KYC via POST /kyc-link.
  if (needsMoreInfo) {
    return (
      <View style={c.card}>
        <View style={[c.iconWrap, { backgroundColor: 'rgba(251,191,36,0.15)' }]}>
          <Ionicons name="document-text-outline" size={24} color="#FBBF24" />
        </View>
        <Text style={c.title}>{t('card.finishVerification')}</Text>
        <Text style={c.text}>
          {t('card.additionalInfoNeeded')}
          {'\n\n'}
          {t('card.continueOnBridge')}
        </Text>
        {needsEmailLink ? (
          <View style={c.emailRequiredBox}>
            <Ionicons name="mail-outline" size={18} color="#FBBF24" />
            <Text style={c.emailRequiredText}>{t('card.linkEmailBeforeKyc')}</Text>
          </View>
        ) : null}
        <PrimaryButton
          label={t('card.continueVerification')}
          icon="open-outline"
          loading={creating}
          disabled={!canStart}
          onPress={handleStart}
        />
        <RefreshLink onRefresh={onRefresh} />
      </View>
    );
  }

  if (inReview) {
    return (
      <View style={c.card}>
        <View style={c.iconWrap}>
          <Ionicons name="time-outline" size={24} color={colors.primary} />
        </View>
        <Text style={c.title}>{t('card.verificationInProgress')}</Text>
        <Text style={c.text}>
          {t('card.verificationInProgressBody')}
        </Text>
        <RefreshLink onRefresh={onRefresh} />
      </View>
    );
  }

  return (
    <View style={c.card}>
      <View style={c.iconWrap}>
        <Ionicons name="shield-checkmark-outline" size={24} color={colors.primary} />
      </View>
      <Text style={c.title}>
        {rejected ? t('card.verificationRejected') : t('card.verifyYourIdentity')}
      </Text>
      {rejected && bridgeReasons.length > 0 ? (
        <View style={c.reasonList}>
          {bridgeReasons.map((reason) => (
            <Text key={reason} style={c.reasonText}>
              {reason}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={c.text}>
          {rejected
            ? t('card.verificationRejectedBody')
            : t('card.verifyPurpose', { purpose })}
        </Text>
      )}

      {rejected ? <SupportContactLink /> : null}

      {needsEmailLink ? (
        <View style={c.emailRequiredBox}>
          <Ionicons name="mail-outline" size={18} color="#FBBF24" />
          <Text style={c.emailRequiredText}>{t('card.linkEmailBeforeKyc')}</Text>
        </View>
      ) : null}

      <PrimaryButton
        label={rejected ? t('card.tryAgainLower') : t('card.startVerificationLower')}
        icon="shield-checkmark"
        loading={creating}
        disabled={!canStart}
        onPress={handleStart}
      />
      <RefreshLink onRefresh={onRefresh} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small building blocks
// ─────────────────────────────────────────────────────────────────────────────

function PrimaryButton({
  label,
  icon,
  loading,
  disabled,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  loading: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const c = useStyles();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading || disabled}
      activeOpacity={0.85}
      style={[c.primaryBtn, disabled && { opacity: 0.4 }]}
    >
      <LinearGradient
        colors={['#7C3AED', '#4F46E5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={c.primaryBtnInner}
      >
        {loading ? (
          <LoadingDots compact color="#FFF" size={6}    />
        ) : (
          <>
            <Ionicons name={icon} size={17} color="#FFF" />
            <Text style={c.primaryBtnText}>{label}</Text>
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

function RefreshLink({ onRefresh }: { onRefresh: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const c = useStyles();
  return (
    <TouchableOpacity style={c.linkBtn} onPress={onRefresh}>
      <Ionicons name="refresh" size={15} color={colors.primary} />
      <Text style={c.linkText}>{t('card.refreshStatus')}</Text>
    </TouchableOpacity>
  );
}

function SupportContactLink() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const c = useStyles();

  const openSupportEmail = () => {
    void Linking.openURL(`mailto:${brand.supportEmail}`).catch(() => undefined);
  };

  return (
    <TouchableOpacity style={c.supportLink} onPress={openSupportEmail} activeOpacity={0.7}>
      <Ionicons name="mail-outline" size={16} color={colors.primary} />
      <Text style={c.supportLinkText}>
        {t('card.contactSupport')}{' '}
        <Text style={c.supportEmailText}>{brand.supportEmail}</Text>
      </Text>
    </TouchableOpacity>
  );
}

function makeStyles(col: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: col.surface,
      borderRadius: 16,
      padding: 20,
      marginTop: 8,
      borderWidth: 1,
      borderColor: col.border,
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(139,92,246,0.15)',
      alignSelf: 'center',
      marginBottom: 14,
    },
    title: {
      color: col.text,
      fontSize: 17,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 6,
    },
    text: {
      color: col.textMuted,
      fontSize: 13,
      lineHeight: 20,
      textAlign: 'center',
      marginBottom: 18,
    },
    reasonList: {
      width: '100%',
      marginBottom: 18,
      gap: 8,
    },
    reasonText: {
      color: col.textMuted,
      fontSize: 13,
      lineHeight: 20,
      textAlign: 'center',
    },
    emailRequiredBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: 'rgba(251,191,36,0.12)',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(251,191,36,0.35)',
      padding: 14,
      marginBottom: 16,
    },
    emailRequiredText: {
      flex: 1,
      color: col.text,
      fontSize: 13,
      lineHeight: 19,
    },

    primaryBtn: { borderRadius: 14, overflow: 'hidden' },
    primaryBtnInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      gap: 8,
    },
    primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

    linkBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
    },
    linkText: { color: col.primary, fontSize: 14, fontWeight: '600' },
    supportLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 18,
      paddingVertical: 4,
    },
    supportLinkText: {
      color: col.textMuted,
      fontSize: 13,
      lineHeight: 20,
      textAlign: 'center',
    },
    supportEmailText: {
      color: col.primary,
      fontWeight: '600',
    },
  });
}
