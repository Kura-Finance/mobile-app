/**
 * GnosisPayOnboardingScreen
 *
 * Step-by-step wizard that guides the user through:
 *   SIWE → Signup → Terms → KYC → SoF → Phone → Safe → Card
 *
 * KYC is done via a Sumsub WebView (no native SDK build required).
 * Each step renders inline — no nested navigator.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../../shared/store/useAppStore';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { DISABLE_EME_JS } from '../../../shared/utils/webviewGuards';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useGnosisPayOnboarding, type GpStep, type UseGnosisPayOnboardingReturn } from '../hooks/useGnosisPayOnboarding';
import CardProductDmPage from '../components/CardProductDmPage';
import type { GpSofSource } from '../../../lib/api/gp/client';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress breadcrumb
// ─────────────────────────────────────────────────────────────────────────────

const STEPS: { key: GpStep; labelKey: string }[] = [
  { key: 'siwe_auth', labelKey: 'card.stepConnect' },
  { key: 'signup', labelKey: 'card.stepSignup' },
  { key: 'terms', labelKey: 'card.stepTerms' },
  { key: 'kyc', labelKey: 'card.stepKyc' },
  { key: 'sof', labelKey: 'card.stepFunds' },
  { key: 'phone', labelKey: 'card.stepPhone' },
  { key: 'safe_deploy', labelKey: 'card.stepWallet' },
  { key: 'card_issue', labelKey: 'card.stepCard' },
];

const STEP_INDICES: Partial<Record<GpStep, number>> = Object.fromEntries(
  STEPS.map(({ key }, i) => [key, i]),
);

function ProgressBar({ step }: { step: GpStep }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const idx = STEP_INDICES[step] ?? -1;
  if (idx < 0) return null;
  const pct = ((idx + 1) / STEPS.length) * 100;
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.progressLabel}>
        {t('card.progressStep', {
          current: idx + 1,
          total: STEPS.length,
          label: STEPS[idx] ? t(STEPS[idx].labelKey) : '',
        })}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI atoms
// ─────────────────────────────────────────────────────────────────────────────

function StepCard({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  return <View style={styles.card}>{children}</View>;
}

function StepTitle({ icon, text }: { icon: string; text: string }) {
  const styles = useStyles();
  return (
    <View style={styles.titleRow}>
      <Text style={styles.titleIcon}>{icon}</Text>
      <Text style={styles.titleText}>{text}</Text>
    </View>
  );
}

function StepBody({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.bodyText}>{children}</Text>;
}

function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const styles = useStyles();
  return (
    <TouchableOpacity
      style={[styles.primaryBtn, disabled && styles.primaryBtnDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <Text style={styles.primaryBtnText}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

function GpInput({
  placeholder,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
  maxLength,
}: {
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: TextInput['props']['keyboardType'];
  autoCapitalize?: TextInput['props']['autoCapitalize'];
  secureTextEntry?: boolean;
  maxLength?: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <TextInput
      style={styles.input}
      placeholder={placeholder}
      placeholderTextColor={colors.textFaint}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize ?? 'none'}
      autoCorrect={false}
      secureTextEntry={secureTextEntry}
      maxLength={maxLength}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step screens
// ─────────────────────────────────────────────────────────────────────────────

function SiweStep({ onPress, loading }: { onPress: () => void; loading: boolean }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <StepCard>
      <StepTitle icon="🔐" text={t('card.connectWalletTitle')} />
      <StepBody>
        {t('card.connectWalletBody')}
      </StepBody>
      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
        <Text style={styles.infoText}>{t('card.kuraWalletWillSign')}</Text>
      </View>
      <PrimaryButton label={t('card.applyNow')} onPress={onPress} loading={loading} />
      <Text style={styles.comingSoonNote}>{t('card.euUkResidentOnly')}</Text>
    </StepCard>
  );
}

function SignupStep({
  defaultEmail,
  onSubmit,
  loading,
}: {
  defaultEmail: string;
  onSubmit: (email: string) => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const styles = useStyles();
  const [email, setEmail] = useState(defaultEmail);
  return (
    <StepCard>
      <StepTitle icon="✉️" text={t('card.createAccount')} />
      <StepBody>{t('card.createAccountBody')}</StepBody>
      <GpInput
        placeholder={t('card.emailPlaceholder')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
      />
      <PrimaryButton
        label={t('card.continue')}
        onPress={() => onSubmit(email.trim())}
        loading={loading}
        disabled={!email.trim().includes('@')}
      />
    </StepCard>
  );
}

function TermsStep({ onAccept, loading }: { onAccept: () => void; loading: boolean }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const [checked, setChecked] = useState(false);
  return (
    <StepCard>
      <StepTitle icon="📋" text={t('card.termsOfService')} />
      <StepBody>
        {t('card.termsBody')}
      </StepBody>
      <TouchableOpacity style={styles.checkRow} onPress={() => setChecked((v) => !v)}>
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
        </View>
        <Text style={styles.checkLabel}>
          {t('card.agreePrefix')}
          <Text style={styles.link}>{t('card.termsLink')}</Text>{t('card.agreeAnd')}
          <Text style={styles.link}>{t('card.privacyLink')}</Text>
        </Text>
      </TouchableOpacity>
      <PrimaryButton
        label={t('card.acceptContinue')}
        onPress={onAccept}
        loading={loading}
        disabled={!checked}
      />
    </StepCard>
  );
}

function KycStep({
  onStart,
  loading,
  kycUrl,
  onWebViewClose,
}: {
  onStart: () => void;
  loading: boolean;
  kycUrl: string | null;
  onWebViewClose: () => void;
}) {
  const { t } = useTranslation();
  const styles = useStyles();
  const { colors } = useTheme();
  const [showWebView, setShowWebView] = useState(false);

  useEffect(() => {
    if (kycUrl) setShowWebView(true);
  }, [kycUrl]);

  const handleWebViewClose = () => {
    setShowWebView(false);
    onWebViewClose();
  };

  const sumsubUrl = kycUrl;

  return (
    <>
      <StepCard>
        <StepTitle icon="🪪" text={t('card.identityVerification')} />
        <StepBody>
          {t('card.kycBody')}
        </StepBody>
        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark-outline" size={16} color="#10B981" />
          <Text style={styles.infoText}>
            {t('card.kycDocsNote')}
          </Text>
        </View>
        <PrimaryButton label={t('card.startVerification')} onPress={onStart} loading={loading} />
      </StepCard>

      <Modal visible={showWebView} animationType="slide" onRequestClose={handleWebViewClose}>
        <View style={styles.webViewContainer}>
          <View style={styles.webViewHeader}>
            <Text style={styles.webViewTitle}>{t('card.identityVerification')}</Text>
            <TouchableOpacity onPress={handleWebViewClose} style={styles.webViewClose}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          {sumsubUrl && (
            <WebView
              source={{ uri: sumsubUrl }}
              style={{ flex: 1, backgroundColor: colors.background }}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction
              injectedJavaScriptBeforeContentLoaded={DISABLE_EME_JS}
              mediaCapturePermissionGrantType="grant"
              onNavigationStateChange={(state) => {
                if (state.url.includes('success') || state.url.includes('approved')) {
                  handleWebViewClose();
                }
              }}
            />
          )}
        </View>
      </Modal>
    </>
  );
}

function KycReviewStep({ onCheck, loading }: { onCheck: () => void; loading: boolean }) {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <StepCard>
      <StepTitle icon="⏳" text={t('card.underReview')} />
      <StepBody>
        {t('card.kycReviewBody')}
      </StepBody>
      <View style={styles.statusPill}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>{t('card.kycSubmitted')}</Text>
      </View>
      <PrimaryButton label={t('card.checkStatus')} onPress={onCheck} loading={loading} />
    </StepCard>
  );
}

const SOF_OPTIONS: { value: GpSofSource; labelKey: string; icon: string }[] = [
  { value: 'employment', labelKey: 'card.sofEmployment', icon: '💼' },
  { value: 'self_employment', labelKey: 'card.sofSelfEmployment', icon: '🧑‍💻' },
  { value: 'savings', labelKey: 'card.sofSavings', icon: '🏦' },
  { value: 'investments', labelKey: 'card.sofInvestments', icon: '📈' },
  { value: 'inheritance', labelKey: 'card.sofInheritance', icon: '🎁' },
  { value: 'other', labelKey: 'card.sofOther', icon: '💡' },
];

function SofStep({
  onSubmit,
  loading,
}: {
  onSubmit: (source: GpSofSource) => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const styles = useStyles();
  const [selected, setSelected] = useState<GpSofSource | null>(null);

  return (
    <StepCard>
      <StepTitle icon="💰" text={t('card.sourceOfFunds')} />
      <StepBody>
        {t('card.sofBody')}
      </StepBody>
      <View style={styles.optionsGrid}>
        {SOF_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.optionChip, selected === opt.value && styles.optionChipSelected]}
            onPress={() => setSelected(opt.value)}
          >
            <Text style={styles.optionIcon}>{opt.icon}</Text>
            <Text
              style={[
                styles.optionLabel,
                selected === opt.value && styles.optionLabelSelected,
              ]}
            >
              {t(opt.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <PrimaryButton
        label={t('card.continue')}
        onPress={() => onSubmit(selected!)}
        loading={loading}
        disabled={!selected}
      />
    </StepCard>
  );
}

type PhoneSubStep = 'enter_phone' | 'enter_otp';

function PhoneStep({
  onSend,
  onVerify,
  loading,
}: {
  onSend: (phone: string) => Promise<void>;
  onVerify: (otp: string) => Promise<void>;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const styles = useStyles();
  const [subStep, setSubStep] = useState<PhoneSubStep>('enter_phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');

  const handleSend = async () => {
    await onSend(phone.trim());
    setSubStep('enter_otp');
  };

  return (
    <StepCard>
      {subStep === 'enter_phone' ? (
        <>
          <StepTitle icon="📱" text={t('card.phoneVerification')} />
          <StepBody>{t('card.phoneBody')}</StepBody>
          <GpInput
            placeholder={t('card.phonePlaceholder')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <PrimaryButton
            label={t('card.sendCode')}
            onPress={handleSend}
            loading={loading}
            disabled={phone.trim().length < 7}
          />
        </>
      ) : (
        <>
          <StepTitle icon="🔢" text={t('card.enterCode')} />
          <StepBody>
            {t('card.otpBody', { phone })}
          </StepBody>
          <GpInput
            placeholder="000000"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
          />
          <PrimaryButton
            label={t('card.verify')}
            onPress={() => onVerify(otp.trim())}
            loading={loading}
            disabled={otp.trim().length !== 6}
          />
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => setSubStep('enter_phone')}
          >
            <Text style={styles.secondaryBtnText}>{t('card.changeNumber')}</Text>
          </TouchableOpacity>
        </>
      )}
    </StepCard>
  );
}

function SafeDeployStep({ onDeploy, loading }: { onDeploy: () => void; loading: boolean }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <StepCard>
      <StepTitle icon="🔒" text={t('card.setUpWallet')} />
      <StepBody>
        {t('card.setUpWalletBody')}
      </StepBody>
      <View style={styles.infoBox}>
        <Ionicons name="shield-outline" size={16} color={colors.primary} />
        <Text style={styles.infoText}>
          {t('card.soleOwnerNote')}
        </Text>
      </View>
      <PrimaryButton label={t('card.setUpWalletBtn')} onPress={onDeploy} loading={loading} />
    </StepCard>
  );
}

function SafePollingStep() {
  const { t } = useTranslation();
  const styles = useStyles();
  const { colors } = useTheme();
  const dots = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(dots, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(dots, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [dots]);

  return (
    <StepCard>
      <StepTitle icon="⚙️" text={t('card.settingUpWallet')} />
      <StepBody>
        {t('card.settingUpWalletBody')}
      </StepBody>
      <View style={styles.spinnerRow}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.spinnerText}>{t('card.waitingForConfirmation')}</Text>
      </View>
    </StepCard>
  );
}

function CardIssueStep({
  onIssue,
  loading,
  safeAddress,
  currency,
}: {
  onIssue: () => void;
  loading: boolean;
  safeAddress: string | null;
  currency: string | null;
}) {
  const { t } = useTranslation();
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <StepCard>
      <StepTitle icon="💳" text={t('card.getYourKuraCard')} />
      <StepBody>
        {t('card.cardIssueBody')}
      </StepBody>
      {safeAddress && (
        <View style={styles.addressBox}>
          <Text style={styles.addressLabel}>
            {t('card.onChainWallet')} {currency ? `· ${currency}` : ''}
          </Text>
          <Text style={styles.addressText} numberOfLines={1} ellipsizeMode="middle">
            {safeAddress}
          </Text>
        </View>
      )}
      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
        <Text style={styles.infoText}>
          {t('card.fundWalletNote', { currency: currency ?? 'EURe' })}
        </Text>
      </View>
      <PrimaryButton label={t('card.issueKuraCard')} onPress={onIssue} loading={loading} />
    </StepCard>
  );
}

function ErrorStep({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <StepCard>
      <StepTitle icon="⚠️" text={t('card.somethingWentWrong')} />
      <StepBody>{message || t('card.unexpectedError')}</StepBody>
      <PrimaryButton label={t('card.tryAgain')} onPress={onRetry} />
    </StepCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function GnosisPayOnboardingScreen({
  onClose,
  embedded,
  onboarding: externalOnboarding,
}: {
  onClose?: () => void;
  /** When true, hides standalone header/loading/complete — for use inside CardManager */
  embedded?: boolean;
  /** Pass hook return from parent to avoid duplicate hook state */
  onboarding?: UseGnosisPayOnboardingReturn;
}) {
  const internal = useGnosisPayOnboarding();
  const onboarding = externalOnboarding ?? internal;
  const {
    step,
    errorMessage,
    card,
    gpSafeAddress,
    safeCurrency,
    kycUrl,
    isLoading,
    doSiweAuth,
    doSignup,
    doAcceptTerms,
    doStartKyc,
    doCheckKycStatus,
    doSubmitSof,
    doSendPhoneOtp,
    doVerifyPhoneOtp,
    doDeploySafe,
    doIssueCard,
    refresh,
  } = onboarding;

  const { t } = useTranslation();
  const styles = useStyles();
  const { colors } = useTheme();
  const userEmail = useAppStore((s) => s.userProfile.email) ?? '';

  if (!embedded && step === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>{t('card.loadingKuraCard')}</Text>
      </View>
    );
  }

  if (!embedded && step === 'complete' && card) {
    return (
      <View style={styles.successWrap}>
        <Text style={styles.successEmoji}>🎉</Text>
        <Text style={styles.successTitle}>{t('card.cardReady')}</Text>
        <Text style={styles.successSub}>
          {t('card.cardEndingPrefix')}
          <Text style={styles.successHighlight}>••••{card.last4}</Text>{t('card.cardEndingSuffix')}
        </Text>
        {card.status === 'active' && (
          <View style={styles.activePill}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>{t('card.active')}</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <GnosisPayOnboardingWizard
      embedded={embedded}
      onClose={onClose}
      step={step}
      errorMessage={errorMessage}
      gpSafeAddress={gpSafeAddress}
      safeCurrency={safeCurrency}
      kycUrl={kycUrl}
      isLoading={isLoading}
      userEmail={userEmail}
      doSiweAuth={doSiweAuth}
      doSignup={doSignup}
      doAcceptTerms={doAcceptTerms}
      doStartKyc={doStartKyc}
      doCheckKycStatus={doCheckKycStatus}
      doSubmitSof={doSubmitSof}
      doSendPhoneOtp={doSendPhoneOtp}
      doVerifyPhoneOtp={doVerifyPhoneOtp}
      doDeploySafe={doDeploySafe}
      doIssueCard={doIssueCard}
      refresh={refresh}
    />
  );
}

function GnosisPayOnboardingWizard({
  embedded,
  onClose,
  step,
  errorMessage,
  gpSafeAddress,
  safeCurrency,
  kycUrl,
  isLoading,
  userEmail,
  doSiweAuth,
  doSignup,
  doAcceptTerms,
  doStartKyc,
  doCheckKycStatus,
  doSubmitSof,
  doSendPhoneOtp,
  doVerifyPhoneOtp,
  doDeploySafe,
  doIssueCard,
  refresh,
}: {
  embedded?: boolean;
  onClose?: () => void;
  step: GpStep;
  errorMessage: string;
  gpSafeAddress: string | null;
  safeCurrency: string | null;
  kycUrl: string | null;
  isLoading: boolean;
  userEmail: string;
  doSiweAuth: () => Promise<void>;
  doSignup: (email: string) => Promise<void>;
  doAcceptTerms: () => Promise<void>;
  doStartKyc: () => Promise<void>;
  doCheckKycStatus: () => Promise<void>;
  doSubmitSof: (source: GpSofSource) => Promise<void>;
  doSendPhoneOtp: (phone: string) => Promise<void>;
  doVerifyPhoneOtp: (code: string) => Promise<void>;
  doDeploySafe: () => Promise<void>;
  doIssueCard: () => Promise<void>;
  refresh: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, embedded && styles.scrollContentEmbedded]}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {!embedded && (
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{t('card.productName')}</Text>
              <Text style={styles.headerSub}>{t('card.headerSub')}</Text>
            </View>
            {onClose && (
              <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.headerClose}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {embedded && step === 'siwe_auth' ? (
          <CardProductDmPage onGetCard={doSiweAuth} loading={isLoading} />
        ) : (
          <>
            <ProgressBar step={step} />

            {step === 'siwe_auth' && (
              <SiweStep onPress={doSiweAuth} loading={isLoading} />
            )}
        {step === 'signup' && (
          <SignupStep defaultEmail={userEmail} onSubmit={doSignup} loading={isLoading} />
        )}
        {step === 'terms' && (
          <TermsStep onAccept={doAcceptTerms} loading={isLoading} />
        )}
        {step === 'kyc' && (
          <KycStep
            onStart={doStartKyc}
            kycUrl={kycUrl}
            loading={isLoading}
            onWebViewClose={doCheckKycStatus}
          />
        )}
        {step === 'kyc_review' && (
          <KycReviewStep onCheck={doCheckKycStatus} loading={isLoading} />
        )}
        {step === 'sof' && (
          <SofStep onSubmit={doSubmitSof} loading={isLoading} />
        )}
        {step === 'phone' && (
          <PhoneStep
            onSend={doSendPhoneOtp}
            onVerify={doVerifyPhoneOtp}
            loading={isLoading}
          />
        )}
        {step === 'safe_deploy' && (
          <SafeDeployStep onDeploy={doDeploySafe} loading={isLoading} />
        )}
        {step === 'safe_polling' && <SafePollingStep />}
        {step === 'card_issue' && (
          <CardIssueStep
            onIssue={doIssueCard}
            loading={isLoading}
            safeAddress={gpSafeAddress}
            currency={safeCurrency}
          />
        )}
        {step === 'error' && (
          <ErrorStep message={errorMessage} onRetry={refresh} />
        )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    center: {
      flex: 1, backgroundColor: c.background,
      justifyContent: 'center', alignItems: 'center', gap: 16,
    },
    loadingText: { color: c.textMuted, fontSize: 14 },

    scroll: { flex: 1, backgroundColor: c.background },
    scrollContent: { padding: 20, paddingBottom: 48 },
    scrollContentEmbedded: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 24 },

    header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24, marginTop: 8, gap: 12 },
    headerTitle: {
      color: c.text, fontSize: 22, fontWeight: '700', marginBottom: 4,
    },
    headerSub: { color: c.textMuted, fontSize: 13, lineHeight: 18 },
    headerClose: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center',
    },

    progressWrap: { marginBottom: 24 },
    progressBg: {
      height: 4, backgroundColor: c.surfaceInput, borderRadius: 2, overflow: 'hidden', marginBottom: 8,
    },
    progressFill: {
      height: '100%', backgroundColor: c.primary, borderRadius: 2,
    },
    progressLabel: { color: c.textMuted, fontSize: 11, fontWeight: '600' },

    card: {
      backgroundColor: c.surface, borderRadius: 16,
      padding: 20, gap: 14,
      borderWidth: 1, borderColor: c.primarySoft,
    },

    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    titleIcon: { fontSize: 22 },
    titleText: { color: c.text, fontSize: 18, fontWeight: '700', flex: 1 },

    bodyText: { color: c.textMuted, fontSize: 14, lineHeight: 20 },

    infoBox: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      backgroundColor: 'rgba(139,92,246,0.08)', borderRadius: 10,
      padding: 12, borderWidth: 1, borderColor: c.primarySoft,
    },
    infoText: { color: c.primary, fontSize: 12, lineHeight: 17, flex: 1 },

    primaryBtn: {
      backgroundColor: c.primary, borderRadius: 14,
      paddingVertical: 15, alignItems: 'center', marginTop: 4,
    },
    primaryBtnDisabled: { opacity: 0.4 },
    primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    comingSoonNote: { color: c.textMuted, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: -2 },

    secondaryBtn: { alignItems: 'center', paddingVertical: 12 },
    secondaryBtnText: { color: c.textMuted, fontSize: 13 },

    input: {
      backgroundColor: c.surfaceInput, borderRadius: 12,
      paddingHorizontal: 16, paddingVertical: 13,
      color: c.text, fontSize: 15,
      borderWidth: 1, borderColor: c.border,
    },

    checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    checkbox: {
      width: 20, height: 20, borderRadius: 5, borderWidth: 2,
      borderColor: c.borderStrong, alignItems: 'center', justifyContent: 'center',
      marginTop: 1,
    },
    checkboxChecked: { backgroundColor: c.primary, borderColor: c.primary },
    checkLabel: { flex: 1, color: c.textMuted, fontSize: 13, lineHeight: 19 },
    link: { color: c.primary, fontWeight: '600' },

    statusPill: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: 'rgba(251,191,36,0.08)', borderRadius: 10,
      paddingVertical: 10, paddingHorizontal: 14,
      borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)',
      alignSelf: 'flex-start',
    },
    statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FBBF24' },
    statusText: { color: '#FBBF24', fontSize: 12, fontWeight: '600' },

    optionsGrid: { gap: 8 },
    optionChip: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: c.surfaceInput, borderRadius: 12,
      paddingVertical: 12, paddingHorizontal: 14,
      borderWidth: 1, borderColor: c.border,
    },
    optionChipSelected: {
      borderColor: c.primary, backgroundColor: 'rgba(139,92,246,0.1)',
    },
    optionIcon: { fontSize: 18 },
    optionLabel: { color: c.textMuted, fontSize: 14 },
    optionLabelSelected: { color: c.primary, fontWeight: '600' },

    spinnerRow: { alignItems: 'center', gap: 12, paddingVertical: 8 },
    spinnerText: { color: c.textMuted, fontSize: 13 },

    addressBox: {
      backgroundColor: c.surfaceInput, borderRadius: 10,
      padding: 12, gap: 4,
    },
    addressLabel: { color: c.textMuted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
    addressText: { color: c.text, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

    webViewContainer: { flex: 1, backgroundColor: c.background },
    webViewHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    webViewTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
    webViewClose: { padding: 4 },

    successWrap: {
      flex: 1, backgroundColor: c.background,
      justifyContent: 'center', alignItems: 'center',
      padding: 32, gap: 16,
    },
    successEmoji: { fontSize: 56 },
    successTitle: { color: c.text, fontSize: 26, fontWeight: '800' },
    successSub: { color: c.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22 },
    successHighlight: { color: c.primary, fontWeight: '700' },
    activePill: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: 20,
      paddingVertical: 8, paddingHorizontal: 14,
      borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)',
    },
    activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
    activeText: { color: '#10B981', fontSize: 13, fontWeight: '600' },
  });
}
