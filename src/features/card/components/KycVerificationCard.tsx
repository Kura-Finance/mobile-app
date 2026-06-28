import LoadingDots from '../../../shared/components/LoadingDots';
/**
 * KycVerificationCard
 *
 * Shared identity-verification gate for the Bridge on/off-ramp flows.
 * Supports both individual KYC and business KYB through the same
 * `POST /api/bridge/kyc-link` endpoint:
 *
 *   - Individual: uses the signed-in user's name / email.
 *   - Business:   collects the company legal name + email, then launches
 *                 Bridge's hosted KYB page (which gathers UBO + documents).
 *
 * The card is purely presentational + form state; the parent owns the
 * `createKycLink` call and the resulting browser hand-off.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type {
  BridgeCustomer,
  CustomerType,
  KycLinkRequest,
} from '../../../lib/api/ramp/client';
import { getKycUiPhase, normalizeKycStatus } from '../../../lib/api/ramp/bridgeKyc';
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
  const existingType = customer?.customerType ?? null;
  const [mode, setMode] = useState<CustomerType>(existingType ?? 'individual');
  const [businessName, setBusinessName] = useState('');
  const [businessEmail, setBusinessEmail] = useState(defaultEmail ?? '');

  const status = normalizeKycStatus(customer?.kycStatus);
  const phase = getKycUiPhase(customer?.kycStatus, customer?.bridgeCustomerId);
  const inReview = phase === 'in_review' || phase === 'unknown';
  const needsMoreInfo =
    status === 'awaiting_questionnaire' || status === 'awaiting_ubo';
  const rejected = status === 'rejected';

  // ── In review: nothing to do but wait ──────────────────────────────────────
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

  // ── KYB needs more info: re-open the hosted page to continue ────────────────
  if (needsMoreInfo) {
    const isUbo = status === 'awaiting_ubo';
    return (
      <View style={c.card}>
        <View style={c.iconWrap}>
          <Ionicons name="document-text-outline" size={24} color="#FBBF24" />
        </View>
        <Text style={c.title}>{t('card.finishVerification')}</Text>
        <Text style={c.text}>
          {isUbo
            ? t('card.uboNeeded')
            : t('card.questionnaireNeeded')}
          {'\n\n'}
          {t('card.continueOnBridge')}
        </Text>
        <PrimaryButton
          label={t('card.continueVerification')}
          icon="open-outline"
          loading={creating}
          disabled={needsEmailLink && (existingType ?? 'business') === 'individual'}
          onPress={() => {
            const email = defaultEmail?.trim();
            if ((existingType ?? 'business') === 'individual' && (!email || needsEmailLink)) {
              return;
            }
            onStartKyc({
              type: existingType ?? 'business',
              fullName: defaultName?.trim() || 'Kura',
              email: email || undefined,
            });
          }}
        />
        <RefreshLink onRefresh={onRefresh} />
      </View>
    );
  }

  // ── Not started / incomplete / rejected: pick type + start ──────────────────
  const individualEmail = defaultEmail?.trim() ?? '';
  const individualEmailValid = /\S+@\S+\.\S+/.test(individualEmail);
  const businessValid =
    businessName.trim().length >= 2 && /\S+@\S+\.\S+/.test(businessEmail.trim());
  const canStart =
    mode === 'individual'
      ? !needsEmailLink && individualEmailValid
      : businessValid;

  const handleStart = () => {
    if (mode === 'business') {
      onStartKyc({
        type: 'business',
        fullName: businessName.trim(),
        email: businessEmail.trim(),
      });
    } else {
      onStartKyc({
        type: 'individual',
        fullName: defaultName?.trim() || 'Kura User',
        email: individualEmail,
      });
    }
  };

  return (
    <View style={c.card}>
      <View style={c.iconWrap}>
        <Ionicons name="shield-checkmark-outline" size={24} color={colors.primary} />
      </View>
      <Text style={c.title}>
        {rejected ? t('card.verificationRejected') : t('card.verifyYourIdentity')}
      </Text>
      <Text style={c.text}>
        {rejected
          ? t('card.verificationRejectedBody')
          : t('card.verifyPurpose', { purpose })}
      </Text>

      {/* Individual / Business toggle — locked once a customer type exists */}
      {!existingType ? (
        <View style={c.segment}>
          {(['individual', 'business'] as CustomerType[]).map((type) => {
            const active = mode === type;
            return (
              <TouchableOpacity
                key={type}
                style={[c.segmentItem, active && c.segmentItemActive]}
                onPress={() => setMode(type)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={type === 'individual' ? 'person-outline' : 'business-outline'}
                  size={15}
                  color={active ? colors.primary : colors.textMuted}
                />
                <Text style={[c.segmentText, active && c.segmentTextActive]}>
                  {type === 'individual' ? t('card.personal') : t('card.business')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {/* Business details */}
      {mode === 'business' ? (
        <View style={c.form}>
          <Text style={c.fieldLabel}>{t('card.companyLegalName')}</Text>
          <TextInput
            value={businessName}
            onChangeText={setBusinessName}
            placeholder={t('card.companyNamePlaceholder')}
            placeholderTextColor={colors.textFaint}
            style={c.input}
            autoCapitalize="words"
          />
          <Text style={c.fieldLabel}>{t('card.businessEmail')}</Text>
          <TextInput
            value={businessEmail}
            onChangeText={setBusinessEmail}
            placeholder={t('card.businessEmailPlaceholder')}
            placeholderTextColor={colors.textFaint}
            style={c.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          <Text style={c.hint}>
            {t('card.uboHint')}
          </Text>
        </View>
      ) : null}

      {needsEmailLink && mode === 'individual' ? (
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

    segment: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    segmentItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: col.surfaceAlt,
      borderWidth: 1,
      borderColor: col.border,
    },
    segmentItemActive: {
      backgroundColor: 'rgba(139,92,246,0.18)',
      borderColor: col.primary,
    },
    segmentText: { color: col.textMuted, fontSize: 14, fontWeight: '700' },
    segmentTextActive: { color: col.primary },

    form: { marginBottom: 4 },
    fieldLabel: {
      color: col.textMuted,
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    input: {
      backgroundColor: col.surfaceAlt,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: col.borderStrong,
      color: col.text,
      fontSize: 15,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 16,
    },
    hint: {
      color: col.textMuted,
      fontSize: 12,
      lineHeight: 17,
      marginBottom: 16,
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
  });
}
