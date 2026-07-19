import LoadingDots from '../../../../shared/components/LoadingDots';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../../../../shared/store/useAppStore';
import { getUsableAuthToken, useSessionUsable } from '../../../../lib/security/sessionAccess';
import { hasVerifiedEmail, needsEmailLink } from '../../../../lib/api/auth/userProfileHelpers';
import { splitDisplayName } from '../../../../lib/auth/oauthDisplayName';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import { makeModalStyles } from '../modalStyles';
import { useMoneyFormat } from '../../../../shared/hooks/useMoneyFormat';
import InlineErrorBanner from '../../../../shared/components/InlineErrorBanner';
import {
  accountTypeForCurrency,
  buildExternalAccountBody,
  createExternalAccount,
  getOrCreatePayoutAddress,
  listExternalAccounts,
  listPayoutDrains,
  listPayoutOptions,
  isPayoutDrainComplete,
  isPayoutDrainTerminal,
  type PayoutDrainResult,
  normalizeRoutingNumber,
  normalizeSortCode,
  resolveEndorsementDetail,
  type ExternalAccountResult,
  type FiatCurrency,
  type FiatRail,
  type KycLinkRequest,
  type PayoutAddressResult,
  type PayoutOption,
} from '../../../../lib/api/ramp/client';
import { BRIDGE_POLL_PAYOUT_PENDING_MS } from '../../hooks/bridgePollConfig';
import { openBridgeHostedKycFlow } from '../../../../lib/api/ramp/hostedFlow';
import { completeBridgeEndorsementFlow } from '../../../../lib/api/ramp/endorsementFlow';
import { formatBridgeRampError } from '../../../../lib/api/ramp/bridgeErrors';
import {
  BRIDGE_ADDRESS_LIMITS,
  clampBridgeText,
  isBridgeStreetLine1Valid,
} from '../../../../lib/api/ramp/externalAccountNormalize';
import KycVerificationCard from '../../components/KycVerificationCard';
import { PAY_GAS_IN_USDC } from '../../config/cardWalletConfig';
import { formatAbaBankName, lookupAbaBank } from '../../../../lib/api/bankRouting/client';
import { useBridgeCustomer } from '../../hooks/useBridgeCustomer';
import { useLocalAuthGate } from '../../../../shared/hooks/useLocalAuthGate';

export interface WithdrawNavState {
  titleKey: string;
  showBack: boolean;
  onBack: () => void;
}

export interface FiatWithdrawPanelProps {
  /** When false, panel resets and skips data fetches. */
  active: boolean;
  onClose: () => void;
  smartAddress: string;
  usdcBalance: number;
  isSending: boolean;
  /** Moves USDC from the SCA to the Bridge crypto deposit address on Base. */
  onSend: (toAddress: string, amount: number) => Promise<string>;
  /** Estimate USDC to reserve for network fees (0 when gas is sponsored). */
  estimateGasReserve: () => Promise<number>;
  /** Preselect a saved bank account (by bridgeExternalAccountId) on open. */
  initialAccountId?: string;
  /** Open straight into the "add bank account" form. */
  startInAddBank?: boolean;
  /** Render inside SendModal (no nested Modal / nav bar). */
  embedded?: boolean;
  /** Sync nav bar title/back with parent when embedded. */
  onNavStateChange?: (state: WithdrawNavState) => void;
}

const SW = Dimensions.get('window').width;

type WithdrawScreen = 'amount' | 'confirm' | 'success' | 'addBankCurrency' | 'addBankForm';

const CURRENCY_FLAGS: Record<string, string> = {
  usd: '🇺🇸', eur: '🇪🇺', gbp: '🇬🇧', brl: '🇧🇷', mxn: '🇲🇽', cop: '🇨🇴',
};

/** Hardcoded off-ramp fee rates (base 100) — display only. */
const WITHDRAW_FEE_PERCENT: Record<FiatCurrency, number> = {
  usd: 0.5,
  gbp: 0.5,
  eur: 0.75,
  mxn: 0.75,
  brl: 0.8,
  cop: 0.75,
};

function withdrawFeeLabel(currency: FiatCurrency): string {
  const percent = WITHDRAW_FEE_PERCENT[currency];
  return `${percent}% ${currency.toUpperCase()}`;
}

const PAYOUT_RAIL_LABEL_KEYS: Partial<Record<FiatRail, string>> = {
  ach_same_day: 'card.payoutRailAchSameDay',
  wire: 'card.payoutRailWire',
  faster_payments: 'card.payoutRailFasterPayments',
  pix: 'card.payoutRailPix',
  spei: 'card.payoutRailSpei',
};

function formatUsdcAvailable(n: number): string {
  if (n === 0) return '0 USDC';
  if (n < 0.0001) return `${n.toExponential(2)} USDC`;
  if (n < 1) return `${n.toFixed(6)} USDC`;
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 4 })} USDC`;
}

function defaultCountryForCurrency(currency: FiatCurrency): string {
  switch (currency) {
    case 'usd':
      return 'USA';
    case 'gbp':
      return 'GBR';
    case 'brl':
      return 'BRA';
    case 'mxn':
      return 'MEX';
    case 'eur':
      return 'IRL';
    default:
      return '';
  }
}

function requiresBillingAddress(currency: FiatCurrency): boolean {
  return currency === 'usd';
}

function payoutRailLabel(rail: FiatRail, t: (key: string) => string): string {
  const key = PAYOUT_RAIL_LABEL_KEYS[rail];
  return key ? t(key) : rail.replace(/_/g, ' ');
}

export function FiatWithdrawPanel({
  active,
  onClose,
  smartAddress,
  usdcBalance,
  isSending,
  onSend,
  estimateGasReserve,
  initialAccountId,
  startInAddBank,
  embedded = false,
  onNavStateChange,
}: FiatWithdrawPanelProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const money = useMoneyFormat();
  const { requireLocalAuth } = useLocalAuthGate();
  const s = useMemo(() => makeModalStyles(colors), [colors]);
  const st = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const userProfile = useAppStore((s) => s.userProfile);
  const authToken = useAppStore((s) => s.authToken);
  const authStatus = useAppStore((s) => s.authStatus);
  const sessionUsable = useSessionUsable();

  const [currency, setCurrency] = useState<FiatCurrency>('usd');
  const {
    customer,
    setCustomer,
    loadingCustomer,
    refreshCustomer: fetchBridgeCustomer,
  } = useBridgeCustomer({ enabled: active && sessionUsable });
  const [creatingKyc, setCreatingKyc] = useState(false);

  const [payoutOptions, setPayoutOptions] = useState<PayoutOption[]>([]);
  const [loadingPayoutOptions, setLoadingPayoutOptions] = useState(false);
  const [selectedRail, setSelectedRail] = useState<FiatRail | null>(null);
  const [payoutAddress, setPayoutAddress] = useState<PayoutAddressResult | null>(null);
  const [loadingPayoutAddress, setLoadingPayoutAddress] = useState(false);

  const [accounts, setAccounts] = useState<ExternalAccountResult[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [screen, setScreen] = useState<WithdrawScreen>('amount');
  const [savingBank, setSavingBank] = useState(false);
  const [lookingUpBankName, setLookingUpBankName] = useState(false);
  const bankNameManualRef = useRef(false);
  const lastAbaLookupRef = useRef('');

  // Add-bank form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [sortCode, setSortCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [clabe, setClabe] = useState('');
  const [breBKey, setBreBKey] = useState('');
  // Account holder address (required for USD only)
  const [street1, setStreet1] = useState('');
  const [street2, setStreet2] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');

  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [doneTxHash, setDoneTxHash] = useState<string | null>(null);
  const [payoutDrain, setPayoutDrain] = useState<PayoutDrainResult | null>(null);
  const [payoutDrainLoading, setPayoutDrainLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorHint, setErrorHint] = useState<string | undefined>();
  const [gasReserve, setGasReserve] = useState(0);
  const [gasEstimating, setGasEstimating] = useState(false);

  const appliedInitial = useRef(false);
  const historyRef = useRef<WithdrawScreen[]>([]);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const isAddBankScreen = screen === 'addBankCurrency' || screen === 'addBankForm';

  const clearError = useCallback(() => {
    setError('');
    setErrorHint(undefined);
  }, []);

  const reportError = useCallback(
    (input: unknown, hint?: string) => {
      if (typeof input === 'string') {
        setError(input);
        setErrorHint(hint);
        return;
      }
      const formatted = formatBridgeRampError(input, t);
      setError(formatted.message);
      setErrorHint(formatted.hint);
    },
    [t],
  );

  const navigate = useCallback((next: WithdrawScreen, dir: 'forward' | 'back' = 'forward') => {
    if (dir === 'forward') historyRef.current.push(screen);
    slideAnim.setValue(dir === 'forward' ? SW : -SW);
    setScreen(next);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 120,
      friction: 16,
    }).start();
  }, [screen, slideAnim]);

  const goBack = useCallback(() => {
    const prev = historyRef.current.pop();
    if (prev === undefined) {
      // Entered add-bank directly from Send picker — exit withdraw flow.
      onClose();
      return;
    }
    navigate(prev, 'back');
  }, [navigate, onClose]);

  const resetFlow = useCallback(() => {
    historyRef.current = [];
    setScreen('amount');
    slideAnim.setValue(0);
  }, [slideAnim]);

  const selectedAccount =
    accounts.find((a) => a.bridgeExternalAccountId === selectedAccountId) ?? null;

  const addBankCurrencies = useMemo(() => {
    const seen = new Set<string>();
    const result: { code: FiatCurrency; flag: string; label: string }[] = [];
    const options = Array.isArray(payoutOptions) ? payoutOptions : [];
    for (const option of options) {
      if (seen.has(option.destinationCurrency)) continue;
      seen.add(option.destinationCurrency);
      const code = option.destinationCurrency;
      result.push({
        code,
        flag: CURRENCY_FLAGS[code] ?? '🏦',
        label: code.toUpperCase(),
      });
    }
    return result;
  }, [payoutOptions]);

  const activeCurrency = (
    selectedAccount?.currency?.toLowerCase() ?? currency
  ) as FiatCurrency;

  const railsForAccount = useMemo(() => {
    const options = Array.isArray(payoutOptions) ? payoutOptions : [];
    const ccy = activeCurrency.toLowerCase();
    return options.filter((o) => o.destinationCurrency.toLowerCase() === ccy);
  }, [payoutOptions, activeCurrency]);

  const hasAnyPayoutOptions = (Array.isArray(payoutOptions) ? payoutOptions : []).length > 0;

  const selectedPayoutOption = railsForAccount.find(
    (o) => o.destinationRail === selectedRail,
  ) ?? null;

  // USDC actually withdrawable once the network fee (paid in USDC) is held back.
  const maxSendable = Math.max(0, usdcBalance - gasReserve);

  const refreshGasEstimate = useCallback(() => {
    if (!PAY_GAS_IN_USDC) {
      setGasReserve(0);
      setGasEstimating(false);
      return;
    }
    setGasEstimating(true);
    estimateGasReserve()
      .then((r) => setGasReserve(r))
      .catch(() => setGasReserve(0))
      .finally(() => setGasEstimating(false));
  }, [estimateGasReserve]);
  const matchingAccounts = accounts.filter(
    (a) => a.currency?.toLowerCase() === currency,
  );

  const resetForm = useCallback(() => {
    const { firstName: profileFirstName, lastName: profileLastName } = splitDisplayName(
      userProfile.displayName,
    );
    setFirstName(profileFirstName);
    setLastName(profileLastName);
    setAccountNumber('');
    setRoutingNumber('');
    setSortCode('');
    setBankName('');
    setIban('');
    setBic('');
    setPixKey('');
    setDocumentNumber('');
    setClabe('');
    setBreBKey('');
    setStreet1('');
    setStreet2('');
    setCity('');
    setRegion('');
    setPostalCode('');
    setCountry('');
    bankNameManualRef.current = false;
    lastAbaLookupRef.current = '';
  }, [userProfile.displayName]);

  const openAddBank = useCallback(() => {
    resetForm();
    clearError();
    navigate('addBankCurrency');
  }, [resetForm, navigate]);

  const refreshCustomer = useCallback(async () => {
    if (!getUsableAuthToken()) {
      setAccounts([]);
      setPayoutOptions([]);
      setLoadingPayoutOptions(false);
      return;
    }
    clearError();
    try {
      const c = await fetchBridgeCustomer();
      if (c?.canTransact) {
        setLoadingPayoutOptions(true);
        try {
          const [list, options] = await Promise.all([
            listExternalAccounts().catch(() => [] as ExternalAccountResult[]),
            listPayoutOptions().catch(() => [] as PayoutOption[]),
          ]);
          setAccounts(list);
          setPayoutOptions(options);
        } catch {
          setAccounts([]);
          setPayoutOptions([]);
        } finally {
          setLoadingPayoutOptions(false);
        }
      }
    } catch (e) {
      reportError(e);
    }
  }, [clearError, fetchBridgeCustomer, reportError]);

  useEffect(() => {
    if (!active) {
      setDoneTxHash(null);
      setAmount('');
      clearError();
      setSelectedRail(null);
      setPayoutAddress(null);
      setAccounts([]);
      setPayoutOptions([]);
      appliedInitial.current = false;
      resetFlow();
      return;
    }
    if (startInAddBank) {
      historyRef.current = [];
      slideAnim.setValue(0);
      setScreen('addBankCurrency');
    } else {
      resetFlow();
    }
    refreshGasEstimate();
  }, [active, startInAddBank, refreshGasEstimate, resetFlow, slideAnim]);

  useEffect(() => {
    if (!active || !sessionUsable || !customer?.canTransact) return;

    let cancelled = false;
    void (async () => {
      setLoadingPayoutOptions(true);
      try {
        const [list, options] = await Promise.all([
          listExternalAccounts().catch(() => [] as ExternalAccountResult[]),
          listPayoutOptions().catch(() => [] as PayoutOption[]),
        ]);
        if (cancelled) return;
        setAccounts(list);
        setPayoutOptions(options);
      } catch {
        if (!cancelled) {
          setAccounts([]);
          setPayoutOptions([]);
        }
      } finally {
        if (!cancelled) setLoadingPayoutOptions(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active, sessionUsable, customer?.canTransact, customer?.bridgeCustomerId]);

  useEffect(() => {
    if (!active || screen !== 'amount' || !payoutAddress) return;
    refreshGasEstimate();
  }, [active, screen, payoutAddress?.depositAddress, refreshGasEstimate]);

  useEffect(() => {
    if (currency !== 'usd' || !isAddBankScreen) return;
    const digits = routingNumber.replace(/\D/g, '');
    if (digits.length !== 9) {
      setLookingUpBankName(false);
      return;
    }
    if (digits === lastAbaLookupRef.current) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      setLookingUpBankName(true);
      void lookupAbaBank(digits)
        .then((info) => {
          if (cancelled) return;
          lastAbaLookupRef.current = digits;
          if (info && !bankNameManualRef.current) {
            setBankName(formatAbaBankName(info.bank_name));
          }
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setLookingUpBankName(false);
        });
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [routingNumber, currency, isAddBankScreen]);

  // Apply a requested preselection once (and switch currency to match it).
  useEffect(() => {
    if (appliedInitial.current || !initialAccountId || accounts.length === 0) return;
    const acct = accounts.find((a) => a.bridgeExternalAccountId === initialAccountId);
    if (acct) {
      const ccy = acct.currency?.toLowerCase() as FiatCurrency | undefined;
      if (ccy) setCurrency(ccy);
      setSelectedAccountId(acct.bridgeExternalAccountId);
      appliedInitial.current = true;
    }
  }, [accounts, initialAccountId]);

  useEffect(() => {
    if (railsForAccount.length === 1) {
      setSelectedRail(railsForAccount[0].destinationRail);
      return;
    }
    if (
      selectedRail &&
      !railsForAccount.some((o) => o.destinationRail === selectedRail)
    ) {
      setSelectedRail(null);
      setPayoutAddress(null);
    }
  }, [railsForAccount, selectedRail]);

  // Keep a sensible default selected account when the list / currency changes
  useEffect(() => {
    if (appliedInitial.current && initialAccountId) return;
    if (matchingAccounts.length > 0) {
      setSelectedAccountId((prev) =>
        prev && matchingAccounts.some((a) => a.bridgeExternalAccountId === prev)
          ? prev
          : matchingAccounts[0].bridgeExternalAccountId,
      );
    } else {
      setSelectedAccountId(null);
    }
  }, [accounts, currency]); // eslint-disable-line react-hooks/exhaustive-deps

  const startKyc = useCallback(async (req: KycLinkRequest) => {
    if (req.type === 'individual' && !hasVerifiedEmail(userProfile)) {
      reportError(t('card.linkEmailBeforeKyc'));
      return;
    }
    if (req.type === 'individual' && !req.email?.trim()) {
      reportError(t('card.linkEmailBeforeKyc'));
      return;
    }
    clearError();
    setCreatingKyc(true);
    try {
      await openBridgeHostedKycFlow(req);
      await refreshCustomer();
    } catch (e) {
      reportError(e);
    } finally {
      setCreatingKyc(false);
    }
  }, [refreshCustomer, userProfile, t]);

  const ensurePayoutAddress = useCallback(async () => {
    if (!getUsableAuthToken()) return;
    if (!selectedAccountId || !selectedRail || !smartAddress) return;
    const acct = accounts.find((a) => a.bridgeExternalAccountId === selectedAccountId);
    if (!acct) return;
    const destCurrency = acct.currency?.toLowerCase() as FiatCurrency;
    setLoadingPayoutAddress(true);
    clearError();
    try {
      const addr = await getOrCreatePayoutAddress({
        destinationRail: selectedRail,
        destinationCurrency: destCurrency,
        externalAccountId: selectedAccountId,
        returnAddress: smartAddress,
      });
      if (!addr.depositAddress?.trim()) {
        throw new Error(t('card.bridgeNoAddress'));
      }
      setPayoutAddress(addr);
    } catch (e) {
      const endorsement = resolveEndorsementDetail(e, destCurrency);
      if (endorsement) {
        try {
          await completeBridgeEndorsementFlow(endorsement);
          const addr = await getOrCreatePayoutAddress({
            destinationRail: selectedRail,
            destinationCurrency: destCurrency,
            externalAccountId: selectedAccountId,
            returnAddress: smartAddress,
          });
          if (!addr.depositAddress?.trim()) {
            throw new Error(t('card.bridgeNoAddress'));
          }
          setPayoutAddress(addr);
          return;
        } catch (retryErr) {
          reportError(retryErr);
        }
      } else {
        reportError(e);
      }
      setPayoutAddress(null);
    } finally {
      setLoadingPayoutAddress(false);
    }
  }, [selectedAccountId, selectedRail, smartAddress, accounts, t]);

  useEffect(() => {
    if (!active || !customer?.canTransact || isAddBankScreen) return;
    if (!sessionUsable || !selectedAccountId || !selectedRail || !smartAddress) return;
    void ensurePayoutAddress();
  }, [
    active,
    sessionUsable,
    customer?.canTransact,
    isAddBankScreen,
    selectedAccountId,
    selectedRail,
    smartAddress,
    ensurePayoutAddress,
  ]);

  const saveBank = useCallback(async () => {
    clearError();
    if (!getUsableAuthToken()) {
      reportError(t('card.bridgeAuthRequired'));
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      reportError(t('card.enterFirstLastName'));
      return;
    }
    if (currency === 'usd') {
      const normalizedRouting = normalizeRoutingNumber(routingNumber);
      if (!accountNumber.trim() || !normalizedRouting) {
        reportError(t('card.accountRoutingRequired'));
        return;
      }
      if (normalizedRouting.length !== 9) {
        reportError(t('card.routingNumberInvalid'), t('card.routingNumberInvalidHint'));
        return;
      }
    }
    if (currency === 'gbp') {
      const normalizedSortCode = normalizeSortCode(sortCode);
      if (!accountNumber.trim() || normalizedSortCode.length !== 6) {
        reportError(t('card.sortCodeAccountRequired'), t('card.sortCodeInvalidHint'));
        return;
      }
    }
    if (currency === 'brl' && (!pixKey.trim() || !documentNumber.trim())) {
      reportError(t('card.pixKeyRequired'), t('card.pixKeyInvalidHint'));
      return;
    }
    if (currency === 'mxn') {
      const clabeDigits = clabe.trim().replace(/\D/g, '');
      if (clabeDigits.length !== 18) {
        reportError(t('card.clabeRequired'), t('card.clabeInvalidHint'));
        return;
      }
    }
    if (currency === 'eur' && !iban.trim()) {
      reportError(t('card.ibanRequired'), t('card.ibanInvalidHint'));
      return;
    }
    if (currency === 'cop') {
      const key = breBKey.trim();
      if (key.length < 10) {
        reportError(t('card.breBKeyRequired'));
        return;
      }
    }
    if (requiresBillingAddress(currency)) {
      if (
        !street1.trim() ||
        !city.trim() ||
        !postalCode.trim() ||
        !country.trim()
      ) {
        reportError(t('card.addressRequired'));
        return;
      }
      if (!region.trim()) {
        reportError(t('card.stateRequired'), t('card.stateRequiredHint'));
        return;
      }
      if (!isBridgeStreetLine1Valid(street1)) {
        reportError(
          street1.trim().length > BRIDGE_ADDRESS_LIMITS.streetLine1Max
            ? t('card.streetLine1TooLong')
            : t('card.streetLine1TooShort'),
          street1.trim().length > BRIDGE_ADDRESS_LIMITS.streetLine1Max
            ? t('card.streetLine1TooLongHint')
            : t('card.streetLine1Hint'),
        );
        return;
      }
      if (street2.trim().length > BRIDGE_ADDRESS_LIMITS.streetLine2Max) {
        reportError(t('card.streetLine2TooLong'), t('card.streetLine2TooLongHint'));
        return;
      }
      if (region.trim().length > BRIDGE_ADDRESS_LIMITS.stateMax) {
        reportError(t('card.stateTooLong'), t('card.stateTooLongHint'));
        return;
      }
    }
    const address =
      requiresBillingAddress(currency) &&
      street1.trim() &&
      city.trim() &&
      region.trim() &&
      postalCode.trim() &&
      country.trim()
        ? {
            street_line_1: street1.trim(),
            street_line_2: street2.trim() || undefined,
            city: city.trim(),
            state: region.trim(),
            postal_code: postalCode.trim(),
            country: country.trim().toUpperCase(),
          }
        : undefined;
    setSavingBank(true);
    try {
      const created = await createExternalAccount(
        buildExternalAccountBody({
          currency,
          accountType: accountTypeForCurrency(currency),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          bankName: bankName.trim() || undefined,
          accountNumber: accountNumber.trim() || undefined,
          routingNumber: normalizeRoutingNumber(routingNumber) || undefined,
          sortCode: sortCode.trim() || undefined,
          checkingOrSavings: 'checking',
          pixKey: pixKey.trim() || undefined,
          documentNumber: documentNumber.trim() || undefined,
          clabe: clabe.trim() || undefined,
          breBKey: breBKey.trim() || undefined,
          iban: iban.trim() || undefined,
          bic: bic.trim() || undefined,
          address,
        }),
      );
      const list = await listExternalAccounts().catch(() => [created]);
      setAccounts(list.length ? list : [created]);
      setSelectedAccountId(created.bridgeExternalAccountId);
      resetForm();
      historyRef.current = [];
      setScreen('amount');
      slideAnim.setValue(0);
    } catch (e) {
      reportError(e);
    } finally {
      setSavingBank(false);
    }
  }, [currency, firstName, lastName, accountNumber, routingNumber, sortCode, pixKey, documentNumber, clabe, breBKey, bankName, iban, bic, street1, street2, city, region, postalCode, country, resetForm, slideAnim, t]);

  const validateAmount = useCallback((): number | null => {
    const value = Number(amount);
    if (!amount || Number.isNaN(value) || value <= 0) {
      reportError(t('card.enterValidAmount'));
      return null;
    }
    if (value > usdcBalance) {
      reportError(t('card.amountExceedsBalance'));
      return null;
    }
    if (value > maxSendable) {
      reportError(t('card.amountLeaveGas'));
      return null;
    }
    if (!payoutAddress?.depositAddress) {
      reportError(t('card.bridgeNoAddress'));
      return null;
    }
    return value;
  }, [amount, usdcBalance, maxSendable, payoutAddress, t]);

  const continueToConfirm = useCallback(() => {
    clearError();
    if (validateAmount() == null) return;
    navigate('confirm');
  }, [validateAmount, navigate]);

  const sendUsdc = useCallback(async () => {
    clearError();
    const value = validateAmount();
    if (value == null) return;
    const gate = await requireLocalAuth('card.biometricWithdrawPrompt');
    if (!gate.allowed) {
      if (gate.message) reportError(gate.message);
      return;
    }
    setSubmitting(true);
    try {
      const hash = await onSend(payoutAddress!.depositAddress, value);
      setDoneTxHash(hash);
      navigate('success');
    } catch (e) {
      reportError(e);
    } finally {
      setSubmitting(false);
    }
  }, [validateAmount, payoutAddress, onSend, navigate, requireLocalAuth, reportError, clearError]);

  useEffect(() => {
    if (screen !== 'success' || !doneTxHash || !payoutAddress?.bridgeLiquidationAddressId) {
      return;
    }

    let alive = true;
    let interval: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      setPayoutDrainLoading(true);
      try {
        const drains = await listPayoutDrains(payoutAddress.bridgeLiquidationAddressId);
        if (!alive) return;
        const match =
          drains.find((d) => (d.depositTxHash ?? '').toLowerCase() === doneTxHash.toLowerCase())
          ?? drains[0]
          ?? null;
        if (match) {
          setPayoutDrain(match);
          if (isPayoutDrainTerminal(match) && interval) {
            clearInterval(interval);
            interval = null;
          }
        }
      } catch {
        // Best-effort — Bridge may not have indexed the drain yet.
      } finally {
        if (alive) setPayoutDrainLoading(false);
      }
    };

    void poll();
    interval = setInterval(() => void poll(), BRIDGE_POLL_PAYOUT_PENDING_MS);

    return () => {
      alive = false;
      if (interval) clearInterval(interval);
    };
  }, [screen, doneTxHash, payoutAddress?.bridgeLiquidationAddressId]);

  const payoutDrainStatusKey = useMemo(() => {
    if (!payoutDrain) return payoutDrainLoading ? 'card.payoutStatusAwaitingBridge' : null;
    switch (payoutDrain.state) {
      case 'in_review':
        return 'card.statusInReview';
      case 'funds_received':
        return 'card.statusConverting';
      case 'payment_submitted':
        return 'card.statusOnItsWay';
      case 'payment_processed':
        return 'card.statusCompleted';
      case 'undeliverable':
        return 'card.payoutStatusUndeliverable';
      case 'returned':
        return 'card.cryptoStatusReturned';
      case 'refunded':
        return 'card.statusRefunded';
      case 'error':
      case 'canceled':
        return 'card.cryptoStatusFailed';
      default:
        return 'card.payoutStatusAwaitingBridge';
    }
  }, [payoutDrain, payoutDrainLoading]);

  const fiatName = (code: FiatCurrency) =>
    t(`card.fiatName${code.charAt(0).toUpperCase()}${code.slice(1)}`);

  const recipientLabel = (account: ExternalAccountResult) =>
    account.accountOwnerName || account.bankName || t('card.recipient');

  const bankAccountMeta = (account: ExternalAccountResult) => {
    const railLabel = selectedPayoutOption
      ? selectedPayoutOption.label || payoutRailLabel(selectedPayoutOption.destinationRail, t)
      : null;
    const parts = [
      account.currency?.toUpperCase(),
      account.last4 ? `•••• ${account.last4}` : null,
      railLabel,
    ].filter(Boolean);
    return parts.join(' · ');
  };

  const renderBankHero = () => {
    if (!selectedAccount) return null;
    return (
      <View style={st.bankHero}>
        <View style={st.bankHeroIcon}>
          <Ionicons name="person-circle-outline" size={24} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.bankHeroName}>{recipientLabel(selectedAccount)}</Text>
          <Text style={st.bankHeroSub}>{bankAccountMeta(selectedAccount)}</Text>
          {screen === 'amount' ? (
            <Text style={st.available}>
              {t('crypto.available', { amount: formatUsdcAvailable(maxSendable) })}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  const renderLoading = () => (
    <View style={st.center}>
      <LoadingDots color={colors.primary} size={8}   />
    </View>
  );

  const renderSuccess = () => (
    <View style={st.successWrap}>
      <View style={s.successBox}>
        <Ionicons
          name={payoutDrain && isPayoutDrainComplete(payoutDrain) ? 'checkmark-circle' : 'time-outline'}
          size={64}
          color={payoutDrain && isPayoutDrainTerminal(payoutDrain) && !isPayoutDrainComplete(payoutDrain)
            ? colors.danger
            : colors.success}
          style={s.successIcon}
        />
        <Text style={s.successTitle}>{t('card.withdrawalSubmitted')}</Text>
        <Text style={s.successSub}>
          {t('card.payoutSendSuccessSub', {
            amount,
            currency: activeCurrency.toUpperCase(),
          })}
        </Text>

        {payoutDrainStatusKey ? (
          <View style={st.drainStatusRow}>
            {payoutDrainLoading && !payoutDrain ? (
              <LoadingDots compact color={colors.primary} size={6} />
            ) : (
              <Ionicons
                name={payoutDrain && isPayoutDrainComplete(payoutDrain) ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={colors.primary}
              />
            )}
            <Text style={st.drainStatusText}>{t(payoutDrainStatusKey)}</Text>
          </View>
        ) : null}

        {!payoutDrain && !payoutDrainLoading ? (
          <Text style={st.drainHint}>{t('card.payoutStatusAwaitingBridgeHint')}</Text>
        ) : null}

        <View style={s.txHashBox}>
          <Text style={s.txHashLabel}>{t('card.txHash')}</Text>
          <Text style={s.txHashValue} numberOfLines={1} ellipsizeMode="middle">
            {doneTxHash}
          </Text>
        </View>
        <TouchableOpacity style={st.doneBtn} onPress={onClose} activeOpacity={0.85}>
          <Text style={st.doneBtnText}>{t('card.done')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAddBankCurrency = () => {
    if (addBankCurrencies.length === 0) {
      return (
        <View style={st.center}>
          <Text style={st.stepSub}>{t('card.payoutNoOptions')}</Text>
        </View>
      );
    }
    return (
      <View>
        <Text style={st.fieldLabel}>{t('card.selectRecipientCurrency')}</Text>
        <Text style={st.stepSub}>{t('card.selectRecipientCurrencySub')}</Text>
        {addBankCurrencies.map((c) => (
          <TouchableOpacity
            key={c.code}
            style={st.bankRow}
            onPress={() => {
              setCurrency(c.code);
              clearError();
              setCountry((prev) => prev || defaultCountryForCurrency(c.code));
              navigate('addBankForm');
            }}
            activeOpacity={0.8}
          >
            <Text style={st.currencyFlag}>{c.flag}</Text>
            <View style={{ flex: 1 }}>
              <Text style={st.bankName}>{c.label}</Text>
              <Text style={st.bankSub}>{fiatName(c.code)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderAddBankForm = () => (
    <View>
      <View style={st.addrRow}>
        <View style={st.addrCol}>
          <Text style={st.fieldLabel}>{t('card.firstName')}</Text>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            placeholder={t('card.firstNamePlaceholder')}
            placeholderTextColor={colors.textFaint}
            style={st.textInput}
            autoCapitalize="words"
            autoCorrect={false}
            textContentType="givenName"
            autoComplete="given-name"
          />
        </View>
        <View style={st.addrCol}>
          <Text style={st.fieldLabel}>{t('card.lastName')}</Text>
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            placeholder={t('card.lastNamePlaceholder')}
            placeholderTextColor={colors.textFaint}
            style={st.textInput}
            autoCapitalize="words"
            autoCorrect={false}
            textContentType="familyName"
            autoComplete="family-name"
          />
        </View>
      </View>

      {currency === 'usd' ? (
        <>
          <Text style={st.fieldLabel}>{t('card.accountNumber')}</Text>
          <TextInput value={accountNumber} onChangeText={setAccountNumber} keyboardType="number-pad" placeholder="000123456789" placeholderTextColor={colors.textFaint} style={st.monoInput} />
          <Text style={st.fieldLabel}>{t('card.routingNumber')}</Text>
          <TextInput
            value={routingNumber}
            onChangeText={(v) => {
              const digits = normalizeRoutingNumber(v);
              setRoutingNumber(digits);
              bankNameManualRef.current = false;
              if (digits.length !== 9) {
                lastAbaLookupRef.current = '';
              }
            }}
            keyboardType="number-pad"
            placeholder={t('card.nineDigits')}
            placeholderTextColor={colors.textFaint}
            style={st.monoInput}
            maxLength={9}
          />
        </>
      ) : currency === 'gbp' ? (
        <>
          <Text style={st.fieldLabel}>{t('card.sortCode')}</Text>
          <TextInput
            value={sortCode}
            onChangeText={(v) => setSortCode(normalizeSortCode(v))}
            keyboardType="number-pad"
            placeholder="123456"
            placeholderTextColor={colors.textFaint}
            style={st.monoInput}
            maxLength={6}
          />
          <Text style={st.fieldLabel}>{t('card.accountNumber')}</Text>
          <TextInput
            value={accountNumber}
            onChangeText={(v) => setAccountNumber(v.replace(/\D/g, '').slice(0, 8))}
            keyboardType="number-pad"
            placeholder="12345678"
            placeholderTextColor={colors.textFaint}
            style={st.monoInput}
            maxLength={8}
          />
        </>
      ) : currency === 'brl' ? (
        <>
          <Text style={st.fieldLabel}>{t('card.pixKey')}</Text>
          <TextInput
            value={pixKey}
            onChangeText={setPixKey}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="email@example.com"
            placeholderTextColor={colors.textFaint}
            style={st.textInput}
          />
          <Text style={st.fieldLabel}>{t('card.documentNumber')}</Text>
          <TextInput
            value={documentNumber}
            onChangeText={setDocumentNumber}
            keyboardType="number-pad"
            placeholder="12345678901"
            placeholderTextColor={colors.textFaint}
            style={st.monoInput}
          />
        </>
      ) : currency === 'mxn' ? (
        <>
          <Text style={st.fieldLabel}>{t('card.clabe')}</Text>
          <TextInput
            value={clabe}
            onChangeText={setClabe}
            keyboardType="number-pad"
            placeholder="012180015300000000"
            placeholderTextColor={colors.textFaint}
            style={st.monoInput}
          />
        </>
      ) : currency === 'cop' ? (
        <>
          <Text style={st.fieldLabel}>{t('card.breBKey')}</Text>
          <TextInput
            value={breBKey}
            onChangeText={setBreBKey}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t('card.breBKeyPlaceholder')}
            placeholderTextColor={colors.textFaint}
            style={st.monoInput}
          />
          <Text style={st.fieldHint}>{t('card.breBKeyHint')}</Text>
        </>
      ) : (
        <>
          <Text style={st.fieldLabel}>IBAN</Text>
          <TextInput value={iban} onChangeText={setIban} autoCapitalize="characters" placeholder="IE90MODR..." placeholderTextColor={colors.textFaint} style={st.monoInput} />
          <Text style={st.fieldLabel}>{t('card.bicOptional')}</Text>
          <TextInput value={bic} onChangeText={setBic} autoCapitalize="characters" placeholder="MODRIE00XXX" placeholderTextColor={colors.textFaint} style={st.monoInput} />
        </>
      )}

      <View style={st.bankNameHeader}>
        <Text style={[st.fieldLabel, { marginBottom: 0 }]}>
          {currency === 'usd' ? t('card.bankName') : t('card.bankNameOptional')}
        </Text>
        {currency === 'usd' && lookingUpBankName ? (
          <LoadingDots compact color={colors.textMuted} size={6}    />
        ) : null}
      </View>
      <TextInput
        value={bankName}
        onChangeText={(v) => {
          bankNameManualRef.current = true;
          setBankName(v);
        }}
        placeholder={t('card.bankNamePlaceholder')}
        placeholderTextColor={colors.textFaint}
        style={st.textInput}
      />

      {requiresBillingAddress(currency) ? (
        <>
          <Text style={[st.fieldLabel, { marginTop: 14 }]}>{t('card.billingAddress')}</Text>
          <TextInput
            value={street1}
            onChangeText={(v) => setStreet1(clampBridgeText(v, BRIDGE_ADDRESS_LIMITS.streetLine1Max))}
            placeholder={t('card.streetLine1')}
            placeholderTextColor={colors.textFaint}
            style={st.textInput}
            maxLength={BRIDGE_ADDRESS_LIMITS.streetLine1Max}
          />
          <Text style={st.fieldHint}>
            {t('card.streetLine1Limit', {
              current: street1.length,
              max: BRIDGE_ADDRESS_LIMITS.streetLine1Max,
              min: BRIDGE_ADDRESS_LIMITS.streetLine1Min,
            })}
          </Text>
          <TextInput
            value={street2}
            onChangeText={(v) => setStreet2(clampBridgeText(v, BRIDGE_ADDRESS_LIMITS.streetLine2Max))}
            placeholder={t('card.streetLine2Optional')}
            placeholderTextColor={colors.textFaint}
            style={st.textInput}
            maxLength={BRIDGE_ADDRESS_LIMITS.streetLine2Max}
          />
          <View style={st.addrRow}>
            <TextInput
              value={city}
              onChangeText={(v) => setCity(clampBridgeText(v, BRIDGE_ADDRESS_LIMITS.cityMax))}
              placeholder={t('card.city')}
              placeholderTextColor={colors.textFaint}
              style={[st.textInput, st.addrCol]}
              maxLength={BRIDGE_ADDRESS_LIMITS.cityMax}
            />
            <TextInput
              value={postalCode}
              onChangeText={(v) => setPostalCode(clampBridgeText(v, BRIDGE_ADDRESS_LIMITS.postalCodeMax))}
              placeholder={t('card.postalCode')}
              placeholderTextColor={colors.textFaint}
              style={[st.monoInput, st.addrCol]}
              maxLength={BRIDGE_ADDRESS_LIMITS.postalCodeMax}
            />
          </View>
          <TextInput
            value={region}
            onChangeText={(v) =>
              setRegion(clampBridgeText(v, BRIDGE_ADDRESS_LIMITS.stateMax).toUpperCase())
            }
            placeholder={t('card.stateProvince')}
            placeholderTextColor={colors.textFaint}
            style={st.textInput}
            maxLength={BRIDGE_ADDRESS_LIMITS.stateMax}
            autoCapitalize="characters"
          />
          <TextInput
            value={country}
            onChangeText={(v) => setCountry(clampBridgeText(v, BRIDGE_ADDRESS_LIMITS.countryLen).toUpperCase())}
            autoCapitalize="characters"
            maxLength={BRIDGE_ADDRESS_LIMITS.countryLen}
            placeholder={t('card.countryPlaceholder')}
            placeholderTextColor={colors.textFaint}
            style={st.monoInput}
          />
        </>
      ) : null}

      {error ? (
        <InlineErrorBanner message={error} hint={errorHint} style={{ marginBottom: 12 }} />
      ) : null}

      <TouchableOpacity onPress={saveBank} disabled={savingBank} activeOpacity={0.85} style={st.primaryBtn}>
        <LinearGradient colors={['#7C3AED', '#4F46E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.primaryBtnInner}>
          {savingBank ? <LoadingDots compact color="#FFF" size={6}    /> : <Text style={st.primaryBtnText}>{t('card.saveRecipient')}</Text>}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderAmountScreen = () => {
    if (authStatus === 'loading' || (authStatus === 'authenticated' && !authToken)) {
      return renderLoading();
    }

    if (!sessionUsable) {
      if (authToken) return renderLoading();
      return (
        <View style={st.center}>
          <Text style={st.stepSub}>{t('card.bridgeAuthRequired')}</Text>
        </View>
      );
    }

    if (loadingCustomer || loadingPayoutOptions) return renderLoading();

    if (!customer?.canTransact) {
      return (
        <KycVerificationCard
          customer={customer}
          defaultName={userProfile.displayName}
          defaultEmail={hasVerifiedEmail(userProfile) ? userProfile.email : ''}
          needsEmailLink={needsEmailLink(userProfile)}
          creating={creatingKyc}
          purpose={t('card.purposeWithdraw')}
          onStartKyc={startKyc}
          onRefresh={refreshCustomer}
        />
      );
    }

    if (!selectedAccount) {
      return (
        <TouchableOpacity style={st.addBankRow} onPress={openAddBank} activeOpacity={0.7}>
          <View style={st.addBankIcon}>
            <Ionicons name="person-add-outline" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.addBankLabel}>{t('card.newRecipient')}</Text>
            <Text style={st.addBankSub}>{t('card.newRecipientSub')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
        </TouchableOpacity>
      );
    }

    if (railsForAccount.length === 0) {
      const supported = [
        ...new Set(
          (Array.isArray(payoutOptions) ? payoutOptions : []).map((o) =>
            o.destinationCurrency.toUpperCase(),
          ),
        ),
      ].join(', ');
      return (
        <View style={st.center}>
          <Text style={st.stepSub}>
            {hasAnyPayoutOptions && selectedAccount
              ? t('card.payoutNoOptionsForCurrency', {
                  currency: activeCurrency.toUpperCase(),
                  supported: supported || 'USD, GBP, BRL, MXN',
                })
              : t('card.payoutNoOptions')}
          </Text>
          {hasAnyPayoutOptions && selectedAccount ? (
            <TouchableOpacity style={st.secondaryBtn} onPress={openAddBank}>
              <Text style={st.secondaryBtnText}>{t('card.newRecipient')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={st.secondaryBtn} onPress={() => void refreshCustomer()}>
              <Text style={st.secondaryBtnText}>{t('card.tryAgain')}</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    if (railsForAccount.length > 1 && !selectedRail) {
      return (
        <View>
          <Text style={st.fieldLabel}>{t('card.payoutSelectMethod')}</Text>
          <Text style={st.stepSub}>{t('card.payoutSelectMethodSub')}</Text>
          {railsForAccount.map((option) => (
            <TouchableOpacity
              key={option.destinationRail}
              style={st.bankRow}
              onPress={() => {
                setSelectedRail(option.destinationRail);
                setPayoutAddress(null);
                clearError();
              }}
              activeOpacity={0.8}
            >
              <View style={st.bankIcon}>
                <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.bankName}>
                  {option.label || payoutRailLabel(option.destinationRail, t)}
                </Text>
                <Text style={st.bankSub}>{activeCurrency.toUpperCase()}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    if (loadingPayoutAddress) {
      return (
        <View style={st.center}>
          <LoadingDots color={colors.primary} size={8}   />
          <Text style={[st.stepSub, { marginTop: 12, marginBottom: 0 }]}>
            {t('card.payoutSettingUpAddress')}
          </Text>
        </View>
      );
    }

    if (!payoutAddress) {
      if (!smartAddress) {
        return (
          <View style={st.center}>
            <Text style={st.stepSub}>{t('card.walletNotReady')}</Text>
          </View>
        );
      }

      return (
        <View style={st.center}>
          {error ? (
            <InlineErrorBanner
              message={error}
              hint={errorHint}
              style={{ marginBottom: 16, alignSelf: 'stretch' }}
            />
          ) : (
            <Text style={[st.stepSub, { marginBottom: 16 }]}>
              {t('card.payoutSetupFailed')}
            </Text>
          )}
          <TouchableOpacity
            style={st.secondaryBtn}
            onPress={() => void ensurePayoutAddress()}
            activeOpacity={0.85}
          >
            <Text style={st.secondaryBtnText}>{t('card.tryAgain')}</Text>
          </TouchableOpacity>
          {railsForAccount.length > 1 ? (
            <TouchableOpacity
              style={[st.secondaryBtn, { marginTop: 10, backgroundColor: 'transparent' }]}
              onPress={() => {
                setSelectedRail(null);
                setPayoutAddress(null);
                clearError();
              }}
              activeOpacity={0.85}
            >
              <Text style={st.changeRailText}>{t('card.payoutChangeMethod')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      );
    }

    return (
      <View>
        {renderBankHero()}

        {railsForAccount.length > 1 ? (
          <TouchableOpacity
            style={st.changeRailBtn}
            onPress={() => {
              setSelectedRail(null);
              setPayoutAddress(null);
            }}
          >
            <Text style={st.changeRailText}>{t('card.payoutChangeMethod')}</Text>
          </TouchableOpacity>
        ) : null}

        <View style={s.amountHeader}>
          <Text style={s.fieldLabel}>{t('card.amountUsdc')}</Text>
          <TouchableOpacity
            onPress={() => {
              setAmount(maxSendable.toFixed(6));
              clearError();
            }}
            disabled={maxSendable <= 0}
          >
            <Text style={[s.maxBtn, maxSendable <= 0 && { opacity: 0.4 }]}>
              {t('card.maxWithAmount', { amount: maxSendable.toFixed(2) })}
            </Text>
          </TouchableOpacity>
        </View>
        <TextInput
          value={amount}
          onChangeText={(v) => {
            setAmount(v);
            clearError();
          }}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={colors.textFaint}
          style={s.input}
        />

        {PAY_GAS_IN_USDC ? (
          <View style={st.gasRow}>
            <Text style={st.gasLabel}>{t('card.gasFee')}</Text>
            <Text style={st.gasValue}>
              {gasEstimating
                ? t('card.estimatingGas')
                : t('card.gasUsdcValue', { gas: money.value(gasReserve) })}
            </Text>
          </View>
        ) : null}

        {maxSendable <= 0 && PAY_GAS_IN_USDC && !gasEstimating ? (
          <InlineErrorBanner
            title={t('card.insufficientUsdcForGasTitle')}
            message={t('card.insufficientUsdcForGasDetail', {
              balance: usdcBalance.toFixed(2),
              gas: gasReserve.toFixed(2),
            })}
            style={{ marginBottom: 12 }}
          />
        ) : null}

        {error ? (
          <InlineErrorBanner message={error} hint={errorHint} style={{ marginBottom: 12 }} />
        ) : null}

        <TouchableOpacity
          onPress={continueToConfirm}
          disabled={!gasEstimating && maxSendable <= 0}
          activeOpacity={0.85}
          style={[st.primaryBtn, !gasEstimating && maxSendable <= 0 && st.submitBtnDisabled]}
        >
          <LinearGradient colors={['#7C3AED', '#4F46E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.primaryBtnInner}>
            <Text style={st.primaryBtnText}>{t('card.continue')}</Text>
            <Ionicons name="arrow-forward" size={17} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

  const renderConfirmScreen = () => {
    const railLabel = selectedPayoutOption
      ? selectedPayoutOption.label || payoutRailLabel(selectedPayoutOption.destinationRail, t)
      : '—';

    return (
      <View>
        {renderBankHero()}

        <View style={st.summaryBox}>
          <ConfirmRow label={t('card.youSend')} value={`${amount} USDC`} valueStyle={st.amountValue} />
          <ConfirmRow label={t('card.toRecipient')} value={recipientLabel(selectedAccount!)} />
          <ConfirmRow
            label={t('card.payoutSelectMethod')}
            value={`${railLabel} · ${activeCurrency.toUpperCase()}`}
          />
          <View style={st.summaryDivider} />
          <ConfirmRow label={t('card.network')} value="Base" />
          <ConfirmRow
            label={t('card.gasFee')}
            value={
              !PAY_GAS_IN_USDC
                ? t('card.feeSponsored')
                : gasEstimating
                  ? t('card.estimatingGas')
                  : t('card.gasUsdcValue', { gas: money.value(gasReserve) })
            }
          />
        </View>

        {error ? (
          <InlineErrorBanner message={error} hint={errorHint} style={{ marginTop: 8 }} />
        ) : null}

        <TouchableOpacity
          onPress={sendUsdc}
          disabled={submitting || isSending}
          activeOpacity={0.85}
          style={[st.confirmBtn, (submitting || isSending) && st.submitBtnDisabled]}
        >
          {submitting || isSending ? (
            <LoadingDots compact color="#FFF" size={6}    />
          ) : (
            <>
              <Ionicons name="arrow-up-outline" size={18} color="#FFF" />
              <Text style={st.confirmBtnText}>{t('card.confirmWithdraw')}</Text>
            </>
          )}
        </TouchableOpacity>

        {payoutAddress ? (
          <Text style={st.amountFootnote}>
            {t('card.payoutAmountLiquidationNote', { address: payoutAddress.depositAddress })}
          </Text>
        ) : null}
        <Text style={st.amountFootnote}>
          {t('card.withdrawFee')}: {withdrawFeeLabel(activeCurrency)}
        </Text>
      </View>
    );
  };

  const renderScreen = () => {
    switch (screen) {
      case 'success':
        return renderSuccess();
      case 'confirm':
        return renderConfirmScreen();
      case 'addBankCurrency':
        return renderAddBankCurrency();
      case 'addBankForm':
        return renderAddBankForm();
      case 'amount':
      default:
        return renderAmountScreen();
    }
  };

  const headerTitleKey = (() => {
    switch (screen) {
      case 'confirm':
        return 'card.confirm';
      case 'success':
        return 'card.withdrawalSubmitted';
      case 'addBankCurrency':
        return 'card.selectRecipientCurrency';
      case 'addBankForm':
        return 'card.addRecipientTitle';
      case 'amount':
      default:
        if (selectedAccount && railsForAccount.length > 1 && !selectedRail) {
          return 'card.payoutSelectMethod';
        }
        return 'card.enterAmount';
    }
  })();

  const showBack = screen === 'confirm' || screen === 'addBankCurrency' || screen === 'addBankForm';

  useEffect(() => {
    if (!embedded || !onNavStateChange || !active) return;
    onNavStateChange({
      titleKey: headerTitleKey,
      showBack: screen !== 'success',
      onBack: () => {
        if (screen === 'amount') onClose();
        else goBack();
      },
    });
  }, [
    embedded,
    onNavStateChange,
    active,
    headerTitleKey,
    screen,
    onClose,
    goBack,
  ]);

  const headerTitle = t(headerTitleKey);

  const handleClose = () => {
    resetFlow();
    onClose();
  };

  const content = (
    <Animated.View style={[st.screenWrap, { transform: [{ translateX: slideAnim }] }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderScreen()}
      </ScrollView>
    </Animated.View>
  );

  if (embedded) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {content}
      </KeyboardAvoidingView>
    );
  }

  return (
    <Modal visible={active} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[st.root, { paddingBottom: insets.bottom }]}
      >
        <View style={st.navBar}>
          <View style={st.handle} />
          <View style={st.titleRow}>
            {showBack ? (
              <TouchableOpacity onPress={goBack} style={st.navBtn} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </TouchableOpacity>
            ) : (
              <View style={st.navBtn} />
            )}
            <Text style={st.navTitle} numberOfLines={1}>{headerTitle}</Text>
            <TouchableOpacity onPress={handleClose} style={st.navBtn} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
        {content}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ConfirmRow({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: object;
}) {
  const { colors } = useTheme();
  const st = useMemo(() => makeConfirmRowStyles(colors), [colors]);
  return (
    <View style={st.row}>
      <Text style={st.rowLabel}>{label}</Text>
      <Text style={[st.rowValue, valueStyle]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function makeConfirmRowStyles(c: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
      paddingVertical: 10,
    },
    rowLabel: { color: c.textMuted, fontSize: 14, flex: 1 },
    rowValue: { color: c.text, fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'right' },
  });
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.backgroundElevated },
    navBar: { paddingHorizontal: 16, paddingBottom: 4, backgroundColor: c.backgroundElevated },
    handle: {
      width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong,
      alignSelf: 'center', marginTop: 12, marginBottom: 14,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    navTitle: { flex: 1, textAlign: 'center', color: c.text, fontSize: 18, fontWeight: '700' },
    navBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    screenWrap: { flex: 1 },

    scroll: { paddingHorizontal: 24, paddingBottom: 32 },
    center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 14 },

    bankHero: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: c.surface, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: c.border, marginBottom: 24,
    },
    bankHeroIcon: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: 'rgba(139,92,246,0.12)', alignItems: 'center', justifyContent: 'center',
    },
    bankHeroName: { color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
    bankHeroSub: { color: c.textMuted, fontSize: 13, marginBottom: 4 },
    available: { color: c.textMuted, fontSize: 13 },
    changeRailBtn: { alignSelf: 'flex-start', marginTop: -12, marginBottom: 16 },
    changeRailText: { color: c.primary, fontSize: 13, fontWeight: '600' },

    gasRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: -8,
      marginBottom: 16,
      paddingHorizontal: 2,
    },
    gasLabel: { color: c.textMuted, fontSize: 13 },
    gasValue: { color: c.text, fontSize: 13, fontWeight: '600' },
    amountFootnote: {
      color: c.textFaint,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 8,
    },

    summaryBox: {
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.borderStrong,
      paddingHorizontal: 16,
      paddingVertical: 4,
      marginBottom: 20,
    },
    summaryDivider: { height: 1, backgroundColor: c.borderStrong, marginVertical: 4 },
    amountValue: { fontSize: 18, fontWeight: '700', color: c.text },
    confirmBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.primary,
      borderRadius: 14,
      paddingVertical: 16,
      marginTop: 8,
    },
    confirmBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

    submitBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 8 },
    submitBtnDisabled: { opacity: 0.5 },
    submitGradient: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 16, gap: 8,
    },
    submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

    successWrap: { flex: 1, paddingHorizontal: 24 },
    drainStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 16,
      marginBottom: 4,
    },
    drainStatusText: { color: c.text, fontSize: 14, fontWeight: '600' },
    drainHint: {
      color: c.textMuted,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 18,
      marginTop: 8,
      marginBottom: 4,
      paddingHorizontal: 8,
    },
    doneBtn: {
      marginTop: 8, backgroundColor: c.primary, borderRadius: 14,
      paddingVertical: 16, alignItems: 'center', width: '100%',
    },
    doneBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

    stepSub: { color: c.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 16, marginTop: -2 },
    fieldLabel: { color: c.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
    fieldHint: { color: c.textFaint, fontSize: 12, lineHeight: 17, marginTop: -10, marginBottom: 18 },
    currencyFlag: { fontSize: 24, lineHeight: 30, width: 36, textAlign: 'center' },
    textInput: {
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.borderStrong,
      color: c.text,
      fontSize: 16,
      fontWeight: '400',
      letterSpacing: 0,
      lineHeight: Platform.OS === 'ios' ? 22 : undefined,
      paddingHorizontal: 16,
      paddingVertical: Platform.OS === 'ios' ? 14 : 12,
      marginBottom: 18,
      ...(Platform.OS === 'android' ? { includeFontPadding: false, textAlignVertical: 'center' as const } : {}),
    },
    monoInput: {
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.borderStrong,
      color: c.text,
      fontSize: 15,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      letterSpacing: 0,
      paddingHorizontal: 16,
      paddingVertical: Platform.OS === 'ios' ? 14 : 12,
      marginBottom: 18,
      ...(Platform.OS === 'android' ? { includeFontPadding: false, textAlignVertical: 'center' as const } : {}),
    },
    addrRow: { flexDirection: 'row', gap: 12 },
    addrCol: { flex: 1 },
    bankNameHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },

    primaryBtn: { borderRadius: 14, overflow: 'hidden' },
    primaryBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
    primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    secondaryBtn: { paddingHorizontal: 28, paddingVertical: 13, borderRadius: 12, backgroundColor: c.surfaceInput, marginTop: 8 },
    secondaryBtnText: { color: c.text, fontSize: 15, fontWeight: '600' },
    linkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
    linkText: { color: c.primary, fontSize: 14, fontWeight: '600' },

    addBankRow: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 8,
      borderWidth: 1, borderColor: c.primarySoft,
    },
    addBankIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(139,92,246,0.12)', alignItems: 'center', justifyContent: 'center' },
    addBankLabel: { color: c.primary, fontSize: 15, fontWeight: '600' },
    addBankSub: { color: c.textMuted, fontSize: 12, marginTop: 1 },

    bankRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 8,
      borderWidth: 1, borderColor: c.border,
    },
    bankRowActive: { borderColor: c.primary, backgroundColor: 'rgba(139,92,246,0.1)' },
    bankIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(139,92,246,0.12)', alignItems: 'center', justifyContent: 'center' },
    bankName: { color: c.text, fontSize: 15, fontWeight: '600' },
    bankSub: { color: c.textMuted, fontSize: 12, marginTop: 1 },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: c.borderStrong },
  });
}
