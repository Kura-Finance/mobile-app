import LoadingDots from '../../../shared/components/LoadingDots';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Clipboard,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { makeModalStyles } from './modalStyles';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { useAppStore } from '../../../shared/store/useAppStore';
import { getUsableAuthToken, useSessionUsable } from '../../../lib/security/sessionAccess';
import { hasVerifiedEmail, needsEmailLink } from '../../../lib/api/auth/userProfileHelpers';
import {
  getOrCreateOnRampAccount,
  getPendingFiatEndorsement,
  formatDepositFeeLabel,
  isUnsupportedCurrencyError,
  listOnRampAccounts,
  resolveEndorsementDetail,
  type EndorsementRequiredDetail,
  type FiatCurrency,
  type KycLinkRequest,
  type VirtualAccount,
} from '../../../lib/api/ramp/client';
import {
  customerNeedsKycAdditionalInfo,
  hasSubmittedKyc,
  getKycUiPhase,
  isBridgeTransactReady,
  isKycApproved,
  isKycInReview,
  isKycPaused,
} from '../../../lib/api/ramp/bridgeKyc';
import { openBridgeHostedKycFlow } from '../../../lib/api/ramp/hostedFlow';
import { completeBridgeEndorsementFlow, openBridgeEndorsementHostedFlow } from '../../../lib/api/ramp/endorsementFlow';
import KycVerificationCard from '../components/KycVerificationCard';
import DepositBulletList from '../components/DepositBulletList';
import { buildFiatDepositBullets } from '../config/receiveDepositBullets';
import { useBridgeCustomer } from '../hooks/useBridgeCustomer';

interface FiatReceivePanelProps {
  smartAddress: string;
  // When provided, the panel shows this currency and hides its own selector
  // (the parent screen owns currency selection — see ReceiveModal two-page flow).
  initialCurrency?: FiatCurrency;
  hideSelector?: boolean;
}

export interface FiatOption {
  code: FiatCurrency;
  label: string;
  name: string;
  flag: string;
  // Display-only rail hint shown on the selection list (backend is authoritative).
  rails: string;
}

// Source fiat currency for the deposit account. Destination is always Base USDC.
export const FIAT_OPTIONS: FiatOption[] = [
  { code: 'usd', label: 'USD', name: 'US Dollar', flag: '🇺🇸', rails: 'ACH · Wire' },
  { code: 'eur', label: 'EUR', name: 'Euro', flag: '🇪🇺', rails: 'SEPA' },
  { code: 'gbp', label: 'GBP', name: 'British Pound', flag: '🇬🇧', rails: 'Faster Payments' },
  { code: 'mxn', label: 'MXN', name: 'Mexican Peso', flag: '🇲🇽', rails: 'SPEI' },
  { code: 'brl', label: 'BRL', name: 'Brazilian Real', flag: '🇧🇷', rails: 'Pix' },
  { code: 'cop', label: 'COP', name: 'Colombian Peso', flag: '🇨🇴', rails: 'Bre-B · PSE' },
];

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
}

export default function FiatReceivePanel({
  smartAddress,
  initialCurrency = 'usd',
  hideSelector = false,
}: FiatReceivePanelProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeModalStyles(colors), [colors]);
  const userProfile = useAppStore((st) => st.userProfile);
  const sessionUsable = useSessionUsable();
  const fiatName = (code: FiatCurrency) =>
    t(`card.fiatName${code.charAt(0).toUpperCase()}${code.slice(1)}`);

  const [currency, setCurrency] = useState<FiatCurrency>(initialCurrency);

  useEffect(() => {
    setCurrency(initialCurrency);
  }, [initialCurrency]);
  const [menuOpen, setMenuOpen] = useState(false);
  const {
    customer,
    setCustomer,
    loadingCustomer,
    refreshCustomer: fetchBridgeCustomer,
  } = useBridgeCustomer({ enabled: sessionUsable });
  const [creatingKyc, setCreatingKyc] = useState(false);

  const [accountsByCurrency, setAccountsByCurrency] = useState<
    Record<string, VirtualAccount>
  >({});
  const [loadingAccount, setLoadingAccount] = useState(false);
  // Currencies Bridge reported as unsupported — don't retry these.
  const [unsupportedByCurrency, setUnsupportedByCurrency] = useState<
    Record<string, boolean>
  >({});
  // Currencies that need a one-time endorsement (BRL → pix, COP → cop, etc.).
  const [endorsementByCurrency, setEndorsementByCurrency] = useState<
    Record<string, EndorsementRequiredDetail>
  >({});

  const surfaceEndorsementRequired = useCallback(
    (code: FiatCurrency, detail: EndorsementRequiredDetail, autoOpenHosted = true) => {
      setEndorsementByCurrency((prev) => ({ ...prev, [code]: detail }));
      if (autoOpenHosted) {
        void openBridgeEndorsementHostedFlow(detail).catch(() => {
          // User can tap "Enable … deposits" to retry.
        });
      }
    },
    [],
  );

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  const account = accountsByCurrency[currency] ?? null;

  const selected = FIAT_OPTIONS.find((o) => o.code === currency)!;

  const refreshCustomer = useCallback(async () => {
    if (!getUsableAuthToken()) {
      setAccountsByCurrency({});
      return;
    }
    setError('');
    try {
      const c = await fetchBridgeCustomer();
      if (c && (c.canTransact || isKycApproved(c.kycStatus))) {
        try {
          const list = await listOnRampAccounts();
          const byCurrency: Record<string, VirtualAccount> = {};
          for (const va of list) byCurrency[va.sourceCurrency] = va;
          setAccountsByCurrency(byCurrency);
        } catch {
          // Non-fatal: accounts are lazily created on demand below.
        }
      }
    } catch (e) {
      setError(errMessage(e));
    }
  }, [fetchBridgeCustomer]);

  const loadAccount = useCallback(
    async (code: FiatCurrency) => {
      setError('');
      setLoadingAccount(true);
      try {
        const pending = getPendingFiatEndorsement(customer, code);
        if (pending) {
          surfaceEndorsementRequired(code, pending, false);
          return;
        }

        const va = await getOrCreateOnRampAccount({
          sourceCurrency: code,
          destinationRail: 'base',
          destinationCurrency: 'usdc',
          toAddress: smartAddress || undefined,
        });
        setAccountsByCurrency((prev) => ({ ...prev, [code]: va }));
      } catch (e) {
        // 400 — Bridge doesn't support this fiat currency. Stop here (no retry)
        // and let the UI show a "currency not supported" message.
        if (isUnsupportedCurrencyError(e)) {
          setUnsupportedByCurrency((prev) => ({ ...prev, [code]: true }));
          return;
        }
        // 409 endorsement_required — BRL (pix), COP (cop), GBP (faster_payments), …
        const endorsementDetail = resolveEndorsementDetail(e, code);
        if (endorsementDetail) {
          surfaceEndorsementRequired(code, endorsementDetail, false);
          return;
        }
        setError(errMessage(e));
      } finally {
        setLoadingAccount(false);
      }
    },
    [customer, smartAddress, surfaceEndorsementRequired],
  );

  // User-initiated: endorsement-link → hosted ToS → poll customer → onramp.
  const completeEndorsement = useCallback(
    async (code: FiatCurrency) => {
      const detail =
        endorsementByCurrency[code] ?? getPendingFiatEndorsement(customer, code);
      if (!detail) return;
      setError('');
      setLoadingAccount(true);
      try {
        const updatedCustomer = await completeBridgeEndorsementFlow(detail);
        setCustomer(updatedCustomer);
        const va = await getOrCreateOnRampAccount({
          sourceCurrency: code,
          destinationRail: 'base',
          destinationCurrency: 'usdc',
          toAddress: smartAddress || undefined,
        });
        setAccountsByCurrency((prev) => ({ ...prev, [code]: va }));
        setEndorsementByCurrency((prev) => {
          const next = { ...prev };
          delete next[code];
          return next;
        });
      } catch (e) {
        setError(errMessage(e));
      } finally {
        setLoadingAccount(false);
      }
    },
    [endorsementByCurrency, customer, smartAddress],
  );

  useEffect(() => {
    if (!sessionUsable) {
      setAccountsByCurrency({});
      return;
    }
    if (!customer || !(customer.canTransact || isKycApproved(customer.kycStatus))) return;

    let cancelled = false;
    void (async () => {
      try {
        const list = await listOnRampAccounts();
        if (cancelled) return;
        const byCurrency: Record<string, VirtualAccount> = {};
        for (const va of list) byCurrency[va.sourceCurrency] = va;
        setAccountsByCurrency(byCurrency);
      } catch {
        // Non-fatal: accounts are lazily created on demand below.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionUsable, customer]);

  // When KYC is approved but a rail endorsement (pix / cop / …) is still missing,
  // surface the enable-deposits card before POST /onramp returns 409.
  useEffect(() => {
    if (!customer) return;
    if (isKycInReview(customer.kycStatus)) return;
    if (getKycUiPhase(customer.kycStatus, customer.bridgeCustomerId) !== 'approved') return;
    if (accountsByCurrency[currency] || endorsementByCurrency[currency]) return;
    const pending = getPendingFiatEndorsement(customer, currency);
    if (pending) {
      surfaceEndorsementRequired(currency, pending, false);
    }
  }, [customer, currency, accountsByCurrency, endorsementByCurrency, surfaceEndorsementRequired]);

  // Once verified, lazily fetch/create the deposit account for the selected
  // currency (idempotent server-side). Cached accounts skip the round-trip.
  useEffect(() => {
    if (!customer) return;
    if (isKycInReview(customer.kycStatus)) return;
    if (!isBridgeTransactReady(customer)) return;
    if (accountsByCurrency[currency] || loadingAccount) return;
    if (unsupportedByCurrency[currency]) return;
    if (endorsementByCurrency[currency]) return;
    void loadAccount(currency);
  }, [customer, currency, accountsByCurrency, loadingAccount, unsupportedByCurrency, endorsementByCurrency, loadAccount]);

  const startKyc = useCallback(async (req: KycLinkRequest) => {
    if (req.type === 'individual' && !hasVerifiedEmail(userProfile)) {
      setError(t('card.linkEmailBeforeKyc'));
      return;
    }
    if (req.type === 'individual' && !req.email?.trim()) {
      setError(t('card.linkEmailBeforeKyc'));
      return;
    }
    setError('');
    setCreatingKyc(true);
    try {
      await openBridgeHostedKycFlow(req);
      await refreshCustomer();
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setCreatingKyc(false);
    }
  }, [refreshCustomer, userProfile, t]);

  const copy = useCallback((key: string, value: string) => {
    Clipboard.setString(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
  }, []);

  const selectCurrency = useCallback((code: FiatCurrency) => {
    setCurrency(code);
    setError('');
    setMenuOpen(false);
  }, []);

  // ── Currency selector (hidden when the parent owns selection) ──────────────
  const renderCurrencySelector = () => {
    if (hideSelector) return null;
    return (
    <>
      <Text style={[s.fieldLabel, { marginBottom: 12 }]}>{t('card.depositCurrency')}</Text>
      <TouchableOpacity style={s.selectField} onPress={() => setMenuOpen(true)} activeOpacity={0.8}>
        <Text style={s.selectFlag}>{selected.flag}</Text>
        <Text style={s.selectLabel}>
          {selected.label} · {fiatName(selected.code)}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity
          style={s.menuBackdrop}
          activeOpacity={1}
          onPress={() => setMenuOpen(false)}
        >
          <View style={s.menuCard}>
            <Text style={s.menuTitle}>{t('card.selectCurrency')}</Text>
            {FIAT_OPTIONS.map((opt) => {
              const active = opt.code === currency;
              return (
                <TouchableOpacity
                  key={opt.code}
                  style={s.menuItem}
                  onPress={() => selectCurrency(opt.code)}
                  activeOpacity={0.7}
                >
                  <Text style={s.selectFlag}>{opt.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.menuItemLabel}>{opt.label}</Text>
                    <Text style={s.menuItemSub}>{fiatName(opt.code)}</Text>
                  </View>
                  {active ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
    );
  };

  // ── KYC status pill ────────────────────────────────────────────────────────
  const renderStatusPill = () => {
    if (!customer) return null;
    // Once verified the user only needs to see the data — hide the pill.
    if (customer.canTransact) return null;
    let bg = 'rgba(156,163,175,0.15)';
    let color = '#9CA3AF';
    let icon: React.ComponentProps<typeof Ionicons>['name'] = 'ellipse-outline';
    let label = t('card.notVerified');

    if (customer.canTransact) {
      bg = 'rgba(16,185,129,0.15)'; color = '#10B981'; icon = 'checkmark-circle'; label = t('card.verified');
    } else if (customerNeedsKycAdditionalInfo(customer)) {
      bg = 'rgba(251,191,36,0.15)'; color = '#FBBF24'; icon = 'document-text-outline'; label = t('card.actionNeeded');
    } else if (isKycPaused(customer.kycStatus)) {
      bg = 'rgba(239,68,68,0.15)'; color = '#EF4444'; icon = 'pause-circle'; label = t('card.verificationPausedTitle');
    } else if (isKycInReview(customer.kycStatus, customer.bridgeCustomerId)) {
      bg = 'rgba(251,191,36,0.15)'; color = '#FBBF24'; icon = 'time-outline'; label = t('card.underReviewLower');
    } else if (customer.kycStatus === 'rejected') {
      bg = 'rgba(239,68,68,0.15)'; color = '#EF4444'; icon = 'close-circle'; label = t('card.verificationRejected');
    }

    return (
      <View style={[s.statusPill, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={14} color={color} />
        <Text style={[s.statusPillText, { color }]}>{label}</Text>
      </View>
    );
  };

  // ── Deposit instructions (persistent virtual account) ──────────────────────
  const renderDepositInstructions = () => {
    const di = account?.depositInstructions;
    if (!di) return null;

    const accountHolderName =
      di.bank_beneficiary_name?.trim() || di.account_holder_name?.trim() || undefined;

    const rows: { key: string; label: string; value?: string }[] = [
      { key: 'account_holder_name', label: t('card.accountHolderName'), value: accountHolderName },
      { key: 'bank_account_number', label: t('card.accountNumber'), value: di.bank_account_number },
      { key: 'bank_routing_number', label: t('card.routingNumber'), value: di.bank_routing_number },
      { key: 'iban', label: 'IBAN', value: di.iban },
      { key: 'bic', label: 'BIC', value: di.bic },
      { key: 'sort_code', label: t('card.sortCode'), value: di.sort_code },
      { key: 'account_number', label: t('card.accountNumber'), value: di.account_number },
      { key: 'clabe', label: 'CLABE', value: di.clabe },
      { key: 'pix_key', label: t('card.pixKey'), value: di.pix_key },
      { key: 'bre_b_key', label: t('card.breBKey'), value: di.bre_b_key },
      { key: 'bank_name', label: t('card.bankLabel'), value: di.bank_name },
      { key: 'bank_address', label: t('card.bankAddress'), value: di.bank_address },
      { key: 'bank_beneficiary_address', label: t('card.beneficiaryAddress'), value: di.bank_beneficiary_address },
    ].filter((r) => !!r.value);

    const feeLabel = formatDepositFeeLabel(account?.depositFee);
    const depositBullets = buildFiatDepositBullets(currency, t, {
      minDeposit: account?.minDeposit,
      feeLabel,
      paymentRails: di.payment_rails,
    });

    return (
      <>
        <View style={s.dataCard}>
          {rows.map((r, i) => (
            <View key={r.key} style={[s.dataRow, i > 0 && s.dataRowBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={s.dataLabel}>{r.label}</Text>
                <Text style={s.dataValue}>{r.value}</Text>
              </View>
              <TouchableOpacity
                style={s.dataCopyBtn}
                onPress={() => copy(r.key, r.value!)}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={copiedKey === r.key ? 'checkmark-circle' : 'copy-outline'}
                  size={18}
                  color={copiedKey === r.key ? colors.success : colors.textFaint}
                />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <Text style={s.depositNoteBelow}>{t('card.depositAccountNote')}</Text>
        <DepositBulletList items={depositBullets} />
      </>
    );
  };

  const renderEndorsementCard = () => (
    <>
      {renderStatusPill()}
      <View style={s.fiatCard}>
        <View style={s.fiatCardIcon}>
          <Ionicons name="shield-checkmark-outline" size={24} color={colors.primary} />
        </View>
        <Text style={s.fiatCardTitle}>
          {t('card.endorsementRequiredTitle', { currency: selected.label })}
        </Text>
        <Text style={s.fiatCardText}>
          {t('card.endorsementRequiredNote', { currency: selected.label })}
        </Text>
        <TouchableOpacity
          onPress={() => completeEndorsement(currency)}
          activeOpacity={0.85}
          style={s.primaryBtn}
          disabled={loadingAccount}
        >
          <LinearGradient
            colors={['#7C3AED', '#4F46E5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.primaryBtnGradient}
          >
            {loadingAccount ? (
              <LoadingDots color="#FFF" size={8}   />
            ) : (
              <Ionicons name="lock-open-outline" size={17} color="#FFF" />
            )}
            <Text style={s.primaryBtnText}>
              {t('card.enableCurrencyDeposits', { currency: selected.label })}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderKycGate = () => (
    <>
      {renderStatusPill()}
      <KycVerificationCard
        customer={customer}
        defaultName={userProfile.displayName}
        defaultEmail={hasVerifiedEmail(userProfile) ? userProfile.email : ''}
        needsEmailLink={needsEmailLink(userProfile)}
        creating={creatingKyc}
        purpose={t('card.purposeDeposit')}
        onStartKyc={startKyc}
        onRefresh={refreshCustomer}
      />
    </>
  );

  const renderTransactReadyBody = () => {
    if (loadingAccount && !account) {
      return (
        <>
          {renderStatusPill()}
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <LoadingDots color={colors.primary} size={8}   />
            <Text style={[s.networkNote, { marginTop: 12 }]}>
              {t('card.settingUpDepositAccount', { currency: selected.label })}
            </Text>
          </View>
        </>
      );
    }

    if (account) {
      return (
        <>
          {renderStatusPill()}
          {renderDepositInstructions()}
        </>
      );
    }

    return (
      <>
        {renderStatusPill()}
        <TouchableOpacity
          onPress={() => loadAccount(currency)}
          activeOpacity={0.85}
          style={s.primaryBtn}
        >
          <LinearGradient
            colors={['#7C3AED', '#4F46E5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.primaryBtnGradient}
          >
            <Ionicons name="cash-outline" size={17} color="#FFF" />
            <Text style={s.primaryBtnText}>{t('card.getDepositDetails')}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={s.networkNote}>
          {t('card.depositConvertNote', { currency: selected.label })}
        </Text>
      </>
    );
  };

  // ── Body by state ──────────────────────────────────────────────────────────
  const renderBody = () => {
    if (loadingCustomer) {
      return (
        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
          <LoadingDots color={colors.primary} size={8}   />
        </View>
      );
    }

    const transactReady = isBridgeTransactReady(customer);

    // Still waiting on Bridge KYC review — show progress, not the start form.
    if (
      customer &&
      isKycInReview(customer.kycStatus, customer.bridgeCustomerId) &&
      !transactReady
    ) {
      return renderKycGate();
    }

    // Never submitted KYC — show verification card.
    if (!hasSubmittedKyc(customer)) {
      return renderKycGate();
    }

    if (unsupportedByCurrency[currency]) {
      return (
        <>
          {renderStatusPill()}
          <View style={s.fiatCard}>
            <View style={s.fiatCardIcon}>
              <Ionicons name="alert-circle-outline" size={24} color={colors.textMuted} />
            </View>
            <Text style={s.fiatCardTitle}>{t('card.currencyNotSupported')}</Text>
            <Text style={[s.fiatCardText, { marginBottom: 0 }]}>
              {t('card.currencyNotSupportedNote', { currency: selected.label })}
            </Text>
          </View>
        </>
      );
    }

    const pendingEndorsement = customer
      ? getPendingFiatEndorsement(customer, currency)
      : null;
    if (pendingEndorsement && !account) {
      return renderEndorsementCard();
    }

    if (endorsementByCurrency[currency] && !account) {
      return renderEndorsementCard();
    }

    if (transactReady) {
      return renderTransactReadyBody();
    }

    // KYC approved but Bridge hasn't flipped canTransact yet, or rail endorsement pending.
    if (customer && isKycApproved(customer.kycStatus)) {
      const pending = getPendingFiatEndorsement(customer, currency);
      if (pending) {
        return renderEndorsementCard();
      }
      return renderKycGate();
    }

    // KYC rejected / not started, etc.
    return renderKycGate();
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {renderCurrencySelector()}
      {error ? <Text style={s.errorText}>{error}</Text> : null}
      {renderBody()}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
